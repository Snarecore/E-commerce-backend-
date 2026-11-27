import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { Shipment } from '../entities/shipment.entity';
import { ShipmentEvent } from '../entities/shipment-event.entity';
import {
    ACTIVE_COURIER_STATUSES,
    CourierProvider,
    ShipmentEventSource,
    ShipmentStatus
} from '../enums/shipment-status.enum';
import { CourierError, CourierProviderClient } from '../providers/courier-provider.interface';
import { SteadfastClient } from '../providers/steadfast/steadfast.client';
import { isKnownSteadfastStatus } from '../providers/steadfast/steadfast-status.mapper';
import { Orders } from '../../order/entity/order.entity';
import { OrdersService } from '../../order/order.service';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/constants/audit-action.enum';
import { AuditModule } from '../../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../../audit-log/constants/audit-target-type.enum';
import { resolvePagination } from '../../../utils/pagination.util';
import { BlacklistService } from '../../risk/services/blacklist.service';

/** Order states from which a shipment may be booked (pending, placed or processing). */
const DISPATCHABLE_ORDER_STATUSES: string[] = [OrderStatus.PENDING, OrderStatus.ORDER_PLACED, OrderStatus.PROCESSING];
const MAX_TRANSIENT_ATTEMPTS = 6;
const LEASE_MS = 2 * 60 * 1000;
const TERMINAL_COURIER_STATUSES: ShipmentStatus[] = [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.PARTIAL_DELIVERED,
    ShipmentStatus.RETURN_IN_TRANSIT
];
const SYSTEM_ACTOR = { id: null, name: 'Steadfast Courier Sync', role: 'system' };

export interface Actor {
    id?: string | null;
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
}

export interface ProviderStatusUpdate {
    providerStatus: string | null;
    source: ShipmentEventSource;
    dedupeKey: string;
    providerEventAt?: Date | null;
    message?: string | null;
    codCollected?: number | null;
    courierCharge?: number | null;
    payload?: Record<string, any> | null;
}

@Injectable()
export class ShipmentService {
    private readonly logger = new Logger(ShipmentService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly steadfast: SteadfastClient,
        private readonly ordersService: OrdersService,
        private readonly auditLogService: AuditLogService,
        private readonly blacklistService: BlacklistService
    ) {}

    private get shipments(): Repository<Shipment> {
        return this.dataSource.getRepository(Shipment);
    }

    private get events(): Repository<ShipmentEvent> {
        return this.dataSource.getRepository(ShipmentEvent);
    }

    private providerFor(provider: string): CourierProviderClient {
        if (provider === CourierProvider.STEADFAST) return this.steadfast;
        throw new HttpException(`Unsupported courier provider "${provider}".`, HttpStatus.BAD_REQUEST);
    }

    // ---------------------------------------------------------------------------------------------
    // Admin: request a booking
    // ---------------------------------------------------------------------------------------------

    /**
     * Validates the order and persists a PENDING_DISPATCH shipment. No courier call happens here;
     * the caller (controller) triggers an immediate dispatch attempt, and the worker retries.
     */
    async requestDispatch(orderId: string, actor: Actor, note?: string): Promise<Shipment> {
        if (!this.steadfast.isEnabled()) {
            throw new HttpException('Steadfast integration is not enabled. Set STEADFAST_ENABLED and API credentials.', HttpStatus.SERVICE_UNAVAILABLE);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const order = await queryRunner.manager.findOne(Orders, {
                where: { id: orderId, isDeleted: false },
                lock: { mode: 'pessimistic_write' }
            });
            if (!order) throw new HttpException('Order not found.', HttpStatus.NOT_FOUND);

            this.assertDispatchable(order);
            await this.assertNoRiskHold(order);

            const live = await queryRunner.manager.findOne(Shipment, {
                where: { activeOrderKey: order.id }
            });
            if (live) {
                throw new HttpException(
                    `Order already has a courier shipment (${live.status}). Cancel it before booking again.`,
                    HttpStatus.CONFLICT
                );
            }

            const previousCount = await queryRunner.manager.count(Shipment, { where: { orderId: order.id } });
            const recipient = this.buildRecipient(order);

            const shipment = queryRunner.manager.create(Shipment, {
                orderId: order.id,
                orderCode: order.orderId,
                activeOrderKey: order.id,
                provider: CourierProvider.STEADFAST,
                invoice: this.buildInvoice(order.orderId, previousCount),
                status: ShipmentStatus.PENDING_DISPATCH,
                codAmount: this.computeCodAmount(order),
                recipientName: recipient.name,
                recipientPhone: recipient.phone,
                recipientAddress: recipient.address,
                note: (note || order.specialNote || '').trim().slice(0, 250) || null,
                attemptCount: 0,
                nextAttemptAt: new Date(),
                requestedByUserId: actor?.id || actor?.userId || null
            });
            const saved = await queryRunner.manager.save(shipment);
            await queryRunner.commitTransaction();

            this.audit(actor, AuditAction.SHIPMENT_DISPATCH_REQUESTED, saved, {
                orderCode: { from: null, to: saved.orderCode },
                codAmount: { from: null, to: saved.codAmount },
                invoice: { from: null, to: saved.invoice }
            });
            return saved;
        } catch (error: any) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
            if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
                throw new HttpException('A shipment for this order was just created by another request.', HttpStatus.CONFLICT);
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private assertDispatchable(order: Orders): void {
        if (!DISPATCHABLE_ORDER_STATUSES.includes(order.status)) {
            throw new HttpException(
                `Order must be "${OrderStatus.ORDER_PLACED}" or "${OrderStatus.PROCESSING}" to book a courier (current: "${order.status}").`,
                HttpStatus.BAD_REQUEST
            );
        }
        const isCod = (order.paymentMethod || 'COD').toUpperCase() === 'COD';
        if (order.paymentStatus === PaymentStatus.REVIEW_REQUIRED) {
            throw new HttpException('Payment is under review. Resolve it before shipping.', HttpStatus.BAD_REQUEST);
        }
        if (!isCod && order.paymentStatus !== PaymentStatus.PAID) {
            throw new HttpException('Online-payment order is not paid yet; it cannot be shipped.', HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * A parcel handed to the courier cannot be recalled, so the risk policy is enforced here, not
     * only displayed: a blacklisted or flagged customer's order stays put until an admin clears the
     * blacklist entry. If the risk store cannot be read, booking fails rather than guessing.
     */
    private async assertNoRiskHold(order: Orders): Promise<void> {
        const shipping = (typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress) || {};
        let risk: Awaited<ReturnType<BlacklistService['evaluateRiskForCustomer']>>;
        try {
            risk = await this.blacklistService.evaluateRiskForCustomer(
                { phone: shipping.phone || '', email: shipping.email || '', ipAddress: (order as { ipAddress?: string }).ipAddress || '' },
                { failClosed: true }
            );
        } catch {
            throw new HttpException('Customer risk check is unavailable right now. Try booking again shortly.', HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (risk.fulfillmentHold) {
            throw new HttpException(
                `Order ${order.orderId} is on risk hold (${risk.policyDecision}: ${risk.reason ?? 'flagged customer'}). Review the customer in the blacklist before shipping.`,
                HttpStatus.CONFLICT
            );
        }
    }

    /** Prepaid orders must never be sent with a collectible amount. */
    computeCodAmount(order: Pick<Orders, 'paymentStatus' | 'totalAmount'>): number {
        if (order.paymentStatus === PaymentStatus.PAID) return 0;
        const total = Number(order.totalAmount || 0);
        if (!Number.isFinite(total) || total < 0) {
            throw new HttpException('Order total is invalid; cannot compute COD amount.', HttpStatus.BAD_REQUEST);
        }
        // Steadfast collects whole taka.
        return Math.round(total);
    }

    buildInvoice(orderCode: string, previousShipments: number): string {
        const base = String(orderCode || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
        if (!base) throw new HttpException('Order has no usable order code for the courier invoice.', HttpStatus.BAD_REQUEST);
        return previousShipments > 0 ? `${base}-R${previousShipments}` : base;
    }

    private buildRecipient(order: Orders): { name: string; phone: string; address: string } {
        const addr = order.shippingAddress || {};
        const name = String(addr.name || '').trim();
        const street = String(addr.address || '').trim();
        const city = String(addr.city || '').trim();
        if (!name) throw new HttpException('Recipient name is missing on the order.', HttpStatus.BAD_REQUEST);
        if (!street) throw new HttpException('Delivery address is missing on the order.', HttpStatus.BAD_REQUEST);

        let phone: string;
        try {
            // +8801XXXXXXXXX -> 01XXXXXXXXX (11 digits, as Steadfast expects)
            phone = '0' + normalizeBDPhone(order.verifiedPhone || addr.phone || '').slice(4);
        } catch {
            throw new HttpException('Recipient phone is not a valid Bangladeshi mobile number.', HttpStatus.BAD_REQUEST);
        }

        const fullAddress = city && !street.toLowerCase().includes(city.toLowerCase()) ? `${street}, ${city}` : street;
        return { name: name.slice(0, 100), phone, address: fullAddress.slice(0, 250) };
    }

    // ---------------------------------------------------------------------------------------------
    // Dispatch (called by the worker and by the controller for an immediate attempt)
    // ---------------------------------------------------------------------------------------------

    /**
     * Claims the shipment with a lease (and counts the attempt) before any network call,
     * so a crash mid-request is detected on the next attempt and resolved by invoice lookup.
     * Returns false when another worker holds it or it is not due.
     */
    async claimForDispatch(shipmentId: string, now = new Date()): Promise<string | null> {
        const leaseToken = randomUUID();
        const result = await this.shipments
            .createQueryBuilder()
            .update(Shipment)
            .set({
                leaseToken,
                leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
                attemptCount: () => 'attemptCount + 1'
            })
            .where('id = :id', { id: shipmentId })
            .andWhere('status = :status', { status: ShipmentStatus.PENDING_DISPATCH })
            .andWhere('(nextAttemptAt IS NULL OR nextAttemptAt <= :now)', { now })
            .andWhere('(leaseExpiresAt IS NULL OR leaseExpiresAt <= :now)', { now })
            .execute();
        return result.affected === 1 ? leaseToken : null;
    }

    async findDueForDispatch(limit: number, now = new Date()): Promise<Shipment[]> {
        return this.shipments
            .createQueryBuilder('s')
            .where('s.status = :status', { status: ShipmentStatus.PENDING_DISPATCH })
            .andWhere('(s.nextAttemptAt IS NULL OR s.nextAttemptAt <= :now)', { now })
            .andWhere('(s.leaseExpiresAt IS NULL OR s.leaseExpiresAt <= :now)', { now })
            .orderBy('s.nextAttemptAt', 'ASC')
            .limit(limit)
            .getMany();
    }

    /** Claims and runs one dispatch attempt. Safe to call concurrently. */
    async dispatchNow(shipmentId: string): Promise<Shipment | null> {
        const leaseToken = await this.claimForDispatch(shipmentId);
        if (!leaseToken) return this.shipments.findOne({ where: { id: shipmentId } });
        await this.runDispatch(shipmentId, leaseToken);
        return this.shipments.findOne({ where: { id: shipmentId } });
    }

    private async runDispatch(shipmentId: string, leaseToken: string): Promise<void> {
        const shipment = await this.shipments.findOne({ where: { id: shipmentId, leaseToken } });
        if (!shipment) return; // lease lost
        const client = this.providerFor(shipment.provider);

        try {
            // A previous attempt may have reached the courier before failing/crashing.
            if (shipment.attemptCount > 1) {
                const existing = await client.findStatusByInvoice(shipment.invoice);
                if (existing) {
                    await this.failDispatch(
                        shipment,
                        `A consignment already exists at the courier for invoice ${shipment.invoice} ` +
                        `(status: ${existing.providerStatus}). Link its consignment ID manually.`,
                        true
                    );
                    return;
                }
            }

            const order = await this.dataSource.getRepository(Orders).findOne({ where: { id: shipment.orderId } });
            if (!order || order.isDeleted || !DISPATCHABLE_ORDER_STATUSES.includes(order.status)) {
                await this.finishWithoutDispatch(shipment, `Order is no longer dispatchable (status: ${order?.status ?? 'deleted'}).`);
                return;
            }

            const result = await client.createConsignment({
                invoice: shipment.invoice,
                recipientName: shipment.recipientName,
                recipientPhone: shipment.recipientPhone,
                recipientAddress: shipment.recipientAddress,
                codAmount: Number(shipment.codAmount),
                note: shipment.note
            });

            const status = client.mapStatus(result.providerStatus || 'in_review');
            const trackingUrl = client.buildTrackingUrl(result.trackingCode);
            const now = new Date();
            await this.shipments.update(
                { id: shipment.id, leaseToken },
                {
                    consignmentId: result.consignmentId,
                    trackingCode: result.trackingCode,
                    trackingUrl,
                    providerStatus: result.providerStatus,
                    status,
                    dispatchedAt: now,
                    lastProviderStatusAt: now,
                    lastSyncedAt: now,
                    leaseToken: null,
                    leaseExpiresAt: null,
                    nextAttemptAt: null,
                    lastError: null
                }
            );
            await this.recordEvent({
                shipmentId: shipment.id,
                source: ShipmentEventSource.DISPATCH,
                providerStatus: result.providerStatus,
                internalStatus: status,
                message: `Consignment ${result.consignmentId} created`,
                payload: { consignmentId: result.consignmentId, trackingCode: result.trackingCode },
                dedupeKey: this.hash(`DISPATCH|${shipment.id}|${result.consignmentId}`),
                providerEventAt: now
            });

            await this.markOrderShipped(shipment.id, order, result.trackingCode || result.consignmentId, trackingUrl);
        } catch (error) {
            await this.handleDispatchError(shipment, error);
        }
    }

    private async handleDispatchError(shipment: Shipment, error: unknown): Promise<void> {
        if (error instanceof CourierError) {
            if (error.kind === 'TRANSIENT') {
                if (shipment.attemptCount >= MAX_TRANSIENT_ATTEMPTS) {
                    await this.failDispatch(shipment, `Gave up after ${shipment.attemptCount} attempts: ${error.message}`, true);
                    return;
                }
                const backoffMs = Math.min(30_000 * 2 ** (shipment.attemptCount - 1), 30 * 60_000);
                await this.shipments.update(
                    { id: shipment.id },
                    {
                        lastError: error.message,
                        nextAttemptAt: new Date(Date.now() + backoffMs),
                        leaseToken: null,
                        leaseExpiresAt: null
                    }
                );
                return;
            }
            const prefix = error.kind === 'DUPLICATE'
                ? 'Courier says this invoice already exists. Link the consignment manually. '
                : error.kind === 'CONFIG'
                    ? 'Courier credentials/config problem. '
                    : 'Courier rejected the booking. ';
            await this.failDispatch(shipment, prefix + error.message, true);
            return;
        }
        this.logger.error(`[Shipment ${shipment.id}] Unexpected dispatch error: ${(error as Error)?.message}`);
        await this.failDispatch(shipment, `Unexpected error: ${(error as Error)?.message || 'unknown'}`, true);
    }

    private async failDispatch(shipment: Shipment, message: string, needsAttention: boolean): Promise<void> {
        await this.shipments.update(
            { id: shipment.id },
            {
                status: ShipmentStatus.DISPATCH_FAILED,
                lastError: message.slice(0, 2000),
                needsAttention,
                leaseToken: null,
                leaseExpiresAt: null,
                nextAttemptAt: null
            }
        );
    }

    private async finishWithoutDispatch(shipment: Shipment, reason: string): Promise<void> {
        await this.shipments.update(
            { id: shipment.id },
            {
                status: ShipmentStatus.CANCELLED,
                activeOrderKey: null,
                lastError: reason,
                leaseToken: null,
                leaseExpiresAt: null,
                nextAttemptAt: null
            }
        );
    }

    /** Writes the order-level courier summary and moves the order to SHIPPED through OrdersService. */
    private async markOrderShipped(shipmentId: string, order: Orders, trackingRef: string, trackingUrl: string | null): Promise<void> {
        try {
            await this.dataSource.getRepository(Orders).update(
                { id: order.id },
                { courierName: 'Steadfast', trackingId: trackingRef, courierTrackingLink: trackingUrl || '' }
            );
            await this.ordersService.updateOrderStatus(
                order.id,
                { newStatus: OrderStatus.SHIPPED, note: `Booked with Steadfast (tracking: ${trackingRef})` },
                SYSTEM_ACTOR
            );
        } catch (error: any) {
            this.logger.error(`[Shipment ${shipmentId}] Consignment created but order update failed: ${error?.message}`);
            await this.shipments.update(
                { id: shipmentId },
                { needsAttention: true, lastError: `Consignment created, but order could not be marked Shipped: ${error?.message}` }
            );
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Status updates (webhook + polling)
    // ---------------------------------------------------------------------------------------------

    async findByProviderReference(provider: string, consignmentId?: string | null, invoice?: string | null): Promise<Shipment | null> {
        if (consignmentId) {
            const byCid = await this.shipments.findOne({ where: { provider, consignmentId: String(consignmentId) } });
            if (byCid) return byCid;
        }
        if (invoice) {
            return this.shipments.findOne({ where: { provider, invoice: String(invoice) } });
        }
        return null;
    }

    /**
     * Applies a courier status to a shipment. Idempotent (dedupeKey) and order-safe
     * (older provider events never overwrite newer ones). Order milestones go through
     * OrdersService.updateOrderStatus so restock rules, history, sockets and emails stay consistent.
     */
    async applyProviderStatus(shipmentId: string, update: ProviderStatusUpdate): Promise<'applied' | 'duplicate' | 'ignored'> {
        let orderEffect: { target: OrderStatus; note: string } | null = null;
        let outcome: 'applied' | 'duplicate' | 'ignored' = 'ignored';

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const shipment = await queryRunner.manager.findOne(Shipment, {
                where: { id: shipmentId },
                lock: { mode: 'pessimistic_write' }
            });
            if (!shipment) {
                await queryRunner.rollbackTransaction();
                return 'ignored';
            }

            const client = this.providerFor(shipment.provider);
            const newStatus = update.providerStatus ? client.mapStatus(update.providerStatus) : null;

            const inserted = await this.insertEventIfNew(queryRunner.manager, {
                shipmentId: shipment.id,
                source: update.source,
                providerStatus: update.providerStatus,
                internalStatus: newStatus,
                message: update.message ?? null,
                payload: update.payload ?? null,
                dedupeKey: update.dedupeKey,
                providerEventAt: update.providerEventAt ?? null
            });
            if (!inserted) {
                await queryRunner.rollbackTransaction();
                return 'duplicate';
            }

            const now = new Date();
            const patch: Partial<Shipment> = { lastSyncedAt: now };

            const isStale = !!(update.providerEventAt && shipment.lastProviderStatusAt &&
                update.providerEventAt.getTime() < new Date(shipment.lastProviderStatusAt).getTime());
            const notYetBooked = !shipment.consignmentId;

            if (newStatus && !isStale && !notYetBooked) {
                const wasTerminal = TERMINAL_COURIER_STATUSES.includes(shipment.status);
                const isTerminal = TERMINAL_COURIER_STATUSES.includes(newStatus);

                if (wasTerminal && !isTerminal) {
                    // e.g. a late "pending" after "delivered": keep the event, don't regress.
                    outcome = 'ignored';
                } else {
                    outcome = 'applied';
                    patch.providerStatus = update.providerStatus;
                    patch.status = newStatus;
                    patch.lastProviderStatusAt = update.providerEventAt ?? now;

                    if (update.courierCharge != null && Number.isFinite(update.courierCharge)) {
                        patch.courierCharge = update.courierCharge;
                    }
                    if (newStatus === ShipmentStatus.DELIVERED || newStatus === ShipmentStatus.PARTIAL_DELIVERED) {
                        patch.deliveredAt = shipment.deliveredAt ?? now;
                        patch.codCollectedAmount = update.codCollected != null && Number.isFinite(update.codCollected)
                            ? update.codCollected
                            : newStatus === ShipmentStatus.DELIVERED ? Number(shipment.codAmount) : shipment.codCollectedAmount;
                    }

                    if (wasTerminal && isTerminal && shipment.status !== newStatus) {
                        patch.needsAttention = true;
                        patch.lastError = `Courier changed final status from ${shipment.status} to ${newStatus}. Review the order manually.`;
                    } else if (newStatus === ShipmentStatus.PARTIAL_DELIVERED) {
                        patch.needsAttention = true;
                        patch.lastError = 'Partial delivery: reconcile collected COD and returned items (RMA) manually.';
                    } else if (newStatus === ShipmentStatus.UNKNOWN && update.providerStatus && !isKnownSteadfastStatus(update.providerStatus)) {
                        patch.needsAttention = true;
                        patch.lastError = `Unrecognised courier status "${update.providerStatus}".`;
                    } else if (shipment.status !== newStatus && newStatus === ShipmentStatus.DELIVERED && !wasTerminal) {
                        orderEffect = { target: OrderStatus.DELIVERED, note: 'Delivered by Steadfast' };
                    } else if (shipment.status !== newStatus && newStatus === ShipmentStatus.IN_TRANSIT && !wasTerminal) {
                        orderEffect = { target: OrderStatus.SHIPPED, note: 'In transit with Steadfast courier' };
                    } else if (shipment.status !== newStatus && newStatus === ShipmentStatus.RETURN_IN_TRANSIT && !wasTerminal) {
                        orderEffect = {
                            target: OrderStatus.RETURNED,
                            note: 'Courier returned the parcel (customer refused/undeliverable). Restock only after RMA inspection.'
                        };
                    }
                }
            }

            await queryRunner.manager.update(Shipment, { id: shipment.id }, patch);
            await queryRunner.commitTransaction();
        } catch (error) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        if (orderEffect) await this.applyOrderEffect(shipmentId, orderEffect.target, orderEffect.note);
        return outcome;
    }

    private async applyOrderEffect(shipmentId: string, target: OrderStatus, note: string): Promise<void> {
        const shipment = await this.shipments.findOne({ where: { id: shipmentId } });
        if (!shipment) return;
        try {
            await this.ordersService.updateOrderStatus(
                shipment.orderId,
                { newStatus: target, note },
                SYSTEM_ACTOR,
                // Courier delivery means the courier holds the cash; PAID is set on settlement.
                { codSettlementPending: true }
            );
        } catch (error: any) {
            this.logger.warn(`[Shipment ${shipmentId}] Order could not move to ${target}: ${error?.message}`);
            await this.shipments.update(
                { id: shipmentId },
                { needsAttention: true, lastError: `Courier reports ${shipment.status}, but order could not move to "${target}": ${error?.message}` }
            );
        }
    }

    /** Polls the courier for one shipment. Skips the write when nothing changed. */
    async syncFromProvider(shipmentId: string): Promise<Shipment | null> {
        const shipment = await this.shipments.findOne({ where: { id: shipmentId } });
        if (!shipment) throw new HttpException('Shipment not found.', HttpStatus.NOT_FOUND);
        if (!shipment.consignmentId) {
            throw new HttpException('Shipment has not been booked with the courier yet.', HttpStatus.BAD_REQUEST);
        }
        const client = this.providerFor(shipment.provider);
        const { providerStatus } = await client.getStatusByConsignmentId(shipment.consignmentId);

        if (providerStatus === shipment.providerStatus) {
            await this.shipments.update({ id: shipment.id }, { lastSyncedAt: new Date() });
        } else {
            await this.applyProviderStatus(shipment.id, {
                providerStatus,
                source: ShipmentEventSource.POLL,
                dedupeKey: this.hash(`POLL|${shipment.id}|${providerStatus}|${randomUUID()}`),
                providerEventAt: null,
                message: `Polled status: ${providerStatus}`
            });
        }
        return this.shipments.findOne({ where: { id: shipment.id } });
    }

    /**
     * Claims shipments for polling by bumping lastSyncedAt with a conditional update,
     * so several app instances don't poll the same shipment.
     */
    async claimDueForPolling(limit: number, staleBefore: Date): Promise<string[]> {
        const candidates = await this.shipments
            .createQueryBuilder('s')
            .select(['s.id', 's.lastSyncedAt'])
            .where('s.status IN (:...statuses)', { statuses: ACTIVE_COURIER_STATUSES })
            .andWhere('s.consignmentId IS NOT NULL')
            .andWhere('(s.lastSyncedAt IS NULL OR s.lastSyncedAt < :staleBefore)', { staleBefore })
            .orderBy('s.lastSyncedAt', 'ASC')
            .limit(limit)
            .getMany();

        const claimed: string[] = [];
        const now = new Date();
        for (const c of candidates) {
            const qb = this.shipments.createQueryBuilder().update(Shipment).set({ lastSyncedAt: now }).where('id = :id', { id: c.id });
            if (c.lastSyncedAt) qb.andWhere('lastSyncedAt = :prev', { prev: c.lastSyncedAt });
            else qb.andWhere('lastSyncedAt IS NULL');
            const res = await qb.execute();
            if (res.affected === 1) claimed.push(c.id);
        }
        return claimed;
    }

    // ---------------------------------------------------------------------------------------------
    // Admin actions
    // ---------------------------------------------------------------------------------------------

    async retryDispatch(shipmentId: string, actor: Actor): Promise<Shipment | null> {
        const shipment = await this.getOrThrow(shipmentId);
        if (shipment.status !== ShipmentStatus.DISPATCH_FAILED) {
            throw new HttpException('Only failed bookings can be retried.', HttpStatus.BAD_REQUEST);
        }
        await this.shipments.update(
            { id: shipment.id },
            { status: ShipmentStatus.PENDING_DISPATCH, nextAttemptAt: new Date(), needsAttention: false, lastError: null }
        );
        this.audit(actor, AuditAction.SHIPMENT_DISPATCH_RETRIED, shipment, { status: { from: shipment.status, to: ShipmentStatus.PENDING_DISPATCH } });
        return this.dispatchNow(shipment.id);
    }

    /** Only for bookings that never reached the courier. Courier-side cancellation happens in the Steadfast panel. */
    async cancelDispatch(shipmentId: string, actor: Actor, reason?: string): Promise<Shipment | null> {
        const shipment = await this.getOrThrow(shipmentId);
        if (shipment.consignmentId) {
            throw new HttpException(
                'This parcel is already booked with Steadfast. Cancel it from the Steadfast merchant panel; the status will sync back.',
                HttpStatus.BAD_REQUEST
            );
        }
        if (![ShipmentStatus.PENDING_DISPATCH, ShipmentStatus.DISPATCH_FAILED].includes(shipment.status)) {
            throw new HttpException(`Cannot cancel a shipment in status ${shipment.status}.`, HttpStatus.BAD_REQUEST);
        }
        if (shipment.leaseExpiresAt && new Date(shipment.leaseExpiresAt) > new Date()) {
            throw new HttpException('A booking attempt is in progress. Try again in a minute.', HttpStatus.CONFLICT);
        }
        await this.shipments.update(
            { id: shipment.id },
            { status: ShipmentStatus.CANCELLED, activeOrderKey: null, needsAttention: false, lastError: reason || 'Cancelled by admin', nextAttemptAt: null }
        );
        this.audit(actor, AuditAction.SHIPMENT_DISPATCH_CANCELLED, shipment, { status: { from: shipment.status, to: ShipmentStatus.CANCELLED } });
        return this.shipments.findOne({ where: { id: shipment.id } });
    }

    /** Manual resolution when the consignment exists at the courier but we never got its ID. */
    async linkConsignment(shipmentId: string, consignmentId: string, trackingCode: string | undefined, actor: Actor): Promise<Shipment | null> {
        const shipment = await this.getOrThrow(shipmentId);
        if (shipment.consignmentId) throw new HttpException('Shipment is already linked to a consignment.', HttpStatus.BAD_REQUEST);
        if (![ShipmentStatus.DISPATCH_FAILED, ShipmentStatus.PENDING_DISPATCH].includes(shipment.status)) {
            throw new HttpException(`Cannot link a shipment in status ${shipment.status}.`, HttpStatus.BAD_REQUEST);
        }
        const client = this.providerFor(shipment.provider);
        const { providerStatus } = await client.getStatusByConsignmentId(consignmentId);
        const status = client.mapStatus(providerStatus);
        const now = new Date();
        const trackingUrl = client.buildTrackingUrl(trackingCode || null);

        await this.shipments.update(
            { id: shipment.id },
            {
                consignmentId,
                trackingCode: trackingCode || null,
                trackingUrl,
                providerStatus,
                status,
                dispatchedAt: now,
                lastProviderStatusAt: now,
                lastSyncedAt: now,
                needsAttention: false,
                lastError: null,
                nextAttemptAt: null,
                leaseToken: null,
                leaseExpiresAt: null
            }
        );
        await this.recordEvent({
            shipmentId: shipment.id,
            source: ShipmentEventSource.ADMIN,
            providerStatus,
            internalStatus: status,
            message: `Linked manually to consignment ${consignmentId}`,
            payload: { consignmentId, trackingCode: trackingCode || null },
            dedupeKey: this.hash(`LINK|${shipment.id}|${consignmentId}`),
            providerEventAt: now
        });
        this.audit(actor, AuditAction.SHIPMENT_LINKED_MANUALLY, shipment, { consignmentId: { from: null, to: consignmentId } });

        const order = await this.dataSource.getRepository(Orders).findOne({ where: { id: shipment.orderId } });
        if (order && DISPATCHABLE_ORDER_STATUSES.includes(order.status)) {
            await this.markOrderShipped(shipment.id, order, trackingCode || consignmentId, trackingUrl);
        }
        return this.shipments.findOne({ where: { id: shipment.id } });
    }

    async resolveAttention(shipmentId: string, actor: Actor, note?: string): Promise<Shipment | null> {
        const shipment = await this.getOrThrow(shipmentId);
        await this.shipments.update({ id: shipment.id }, { needsAttention: false });
        await this.recordEvent({
            shipmentId: shipment.id,
            source: ShipmentEventSource.ADMIN,
            providerStatus: null,
            internalStatus: shipment.status,
            message: `Attention resolved${note ? `: ${note}` : ''}`,
            payload: null,
            dedupeKey: this.hash(`RESOLVE|${shipment.id}|${randomUUID()}`),
            providerEventAt: null
        });
        this.audit(actor, AuditAction.SHIPMENT_ATTENTION_RESOLVED, shipment, {
            needsAttention: { from: shipment.needsAttention, to: false },
            lastError: { from: shipment.lastError, to: note || null }
        });
        return this.shipments.findOne({ where: { id: shipment.id } });
    }

    /**
     * Marks the courier's COD payout as received. This (not courier delivery) is what makes
     * a COD order PAID.
     */
    async markCodSettled(shipmentId: string, actor: Actor, reference?: string): Promise<Shipment | null> {
        const shipment = await this.getOrThrow(shipmentId);
        if (![ShipmentStatus.DELIVERED, ShipmentStatus.PARTIAL_DELIVERED].includes(shipment.status)) {
            throw new HttpException('COD can be settled only for delivered shipments.', HttpStatus.BAD_REQUEST);
        }
        if (shipment.codSettledAt) throw new HttpException('COD is already marked as settled.', HttpStatus.BAD_REQUEST);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.update(
                Shipment,
                { id: shipment.id },
                { codSettledAt: new Date(), codSettlementRef: (reference || '').trim().slice(0, 100) || null }
            );
            const order = await queryRunner.manager.findOne(Orders, { where: { id: shipment.orderId }, lock: { mode: 'pessimistic_write' } });
            if (order && (order.paymentMethod || 'COD').toUpperCase() === 'COD' && order.paymentStatus !== PaymentStatus.PAID) {
                await queryRunner.manager.update(Orders, { id: order.id }, { paymentStatus: PaymentStatus.PAID });
            }
            await queryRunner.commitTransaction();
        } catch (error) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        this.audit(actor, AuditAction.SHIPMENT_COD_SETTLED, shipment, {
            codCollectedAmount: { from: null, to: shipment.codCollectedAmount },
            codSettlementRef: { from: null, to: reference || null }
        });
        return this.shipments.findOne({ where: { id: shipment.id } });
    }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    async listForOrder(orderId: string): Promise<Array<Shipment & { events: ShipmentEvent[] }>> {
        const shipments = await this.shipments.find({ where: { orderId }, order: { createdAt: 'DESC' } });
        if (!shipments.length) return [];
        const events = await this.events.find({
            where: { shipmentId: In(shipments.map((s) => s.id)) },
            order: { createdAt: 'DESC' }
        });
        return shipments.map((s) => Object.assign(s, { events: events.filter((e) => e.shipmentId === s.id) }));
    }

    async listShipments(filter: {
        status?: string;
        needsAttention?: boolean;
        codUnsettled?: boolean;
        q?: string;
        page?: number;
        limit?: number;
    }) {
        const { page, limit } = resolvePagination(filter.page, filter.limit, 20);

        const qb = this.shipments.createQueryBuilder('s');
        if (filter.status) qb.andWhere('s.status = :status', { status: filter.status });
        if (filter.needsAttention) qb.andWhere('s.needsAttention = :na', { na: true });
        if (filter.codUnsettled) {
            qb.andWhere('s.status IN (:...delivered)', { delivered: [ShipmentStatus.DELIVERED, ShipmentStatus.PARTIAL_DELIVERED] })
                .andWhere('s.codSettledAt IS NULL')
                .andWhere('s.codAmount > 0');
        }
        const rawQ = (filter.q || '').trim();
        const cleanQ = rawQ.replace(/^#/, '').trim();
        if (cleanQ) {
            const escaped = cleanQ.replace(/[%_\\]/g, '\\$&');
            qb.andWhere(
                '(s.orderCode LIKE :q OR s.invoice LIKE :q OR s.consignmentId LIKE :q OR s.trackingCode LIKE :q OR s.recipientName LIKE :q OR s.recipientPhone LIKE :q)',
                { q: `%${escaped}%` }
            );
        }

        // Totals over the whole filtered set, not just this page (useful for COD payout matching).
        const totals = await qb
            .clone()
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.codAmount), 0)', 'codAmount')
            .addSelect('COALESCE(SUM(s.codCollectedAmount), 0)', 'codCollected')
            .addSelect('COALESCE(SUM(s.courierCharge), 0)', 'courierCharge')
            .getRawOne();

        const data = await qb
            .orderBy('s.updatedAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        const total = Number(totals?.count || 0);
        return {
            data,
            total,
            page,
            limit,
            pageCount: Math.ceil(total / limit),
            summary: {
                codAmount: Number(totals?.codAmount || 0),
                codCollected: Number(totals?.codCollected || 0),
                courierCharge: Number(totals?.courierCharge || 0)
            }
        };
    }

    /**
     * Orders the admin has confirmed but not yet booked with a courier.
     * Payment eligibility mirrors assertDispatchable so the list never offers an order that would be refused.
     */
    async listReadyToBook(filter: { q?: string; page?: number; limit?: number }) {
        const { page, limit } = resolvePagination(filter.page, filter.limit, 20);

        const qb = this.dataSource
            .getRepository(Orders)
            .createQueryBuilder('o')
            .leftJoin(Shipment, 's', 's.activeOrderKey = o.id')
            .where('o.isDeleted = false')
            .andWhere('o.status IN (:...statuses)', { statuses: DISPATCHABLE_ORDER_STATUSES })
            .andWhere('s.id IS NULL')
            .andWhere('o.paymentStatus != :review', { review: PaymentStatus.REVIEW_REQUIRED })
            .andWhere("(UPPER(COALESCE(o.paymentMethod, 'COD')) = 'COD' OR o.paymentStatus = :paid)", { paid: PaymentStatus.PAID });

        const rawQ = (filter.q || '').trim();
        const cleanQ = rawQ.replace(/^#/, '').trim();
        if (cleanQ) {
            const escaped = cleanQ.replace(/[%_\\]/g, '\\$&');
            qb.andWhere(
                '(o.orderId LIKE :q OR o.shippingAddress LIKE :q)',
                { q: `%${escaped}%` }
            );
        }

        const [orders, total] = await qb
            .orderBy('o.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        const data = orders.map((o) => {
            const addr = o.shippingAddress || {};
            let problem: string | null = null;
            try {
                this.buildRecipient(o);
            } catch (e: any) {
                problem = e?.message || 'Invalid recipient';
            }
            return {
                id: o.id,
                orderId: o.orderId,
                status: o.status,
                paymentMethod: o.paymentMethod,
                paymentStatus: o.paymentStatus,
                totalAmount: Number(o.totalAmount || 0),
                codAmount: o.paymentStatus === PaymentStatus.PAID ? 0 : Math.round(Number(o.totalAmount || 0)),
                customerName: addr.name || '',
                phone: o.verifiedPhone || addr.phone || '',
                city: addr.city || '',
                createdAt: o.createdAt,
                problem
            };
        });

        return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
    }

    /**
     * Validates and queues many orders. Courier calls happen in the dispatch worker,
     * so the request returns quickly even for large batches.
     */
    async requestDispatchBulk(orderIds: string[], actor: Actor): Promise<Array<{ orderId: string; ok: boolean; shipmentId?: string; message: string }>> {
        const unique = Array.from(new Set(orderIds));
        const results: Array<{ orderId: string; ok: boolean; shipmentId?: string; message: string }> = [];
        for (const orderId of unique) {
            try {
                const shipment = await this.requestDispatch(orderId, actor);
                results.push({ orderId, ok: true, shipmentId: shipment.id, message: 'Queued for booking' });
            } catch (error: any) {
                results.push({ orderId, ok: false, message: error?.message || 'Failed' });
            }
        }
        return results;
    }

    /** One Steadfast payout usually covers many parcels: settle them together under one reference. */
    async markCodSettledBulk(shipmentIds: string[], actor: Actor, reference?: string) {
        const results: Array<{ shipmentId: string; ok: boolean; message: string }> = [];
        for (const shipmentId of Array.from(new Set(shipmentIds))) {
            try {
                await this.markCodSettled(shipmentId, actor, reference);
                results.push({ shipmentId, ok: true, message: 'Settled' });
            } catch (error: any) {
                results.push({ shipmentId, ok: false, message: error?.message || 'Failed' });
            }
        }
        return results;
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private async getOrThrow(id: string): Promise<Shipment> {
        const shipment = await this.shipments.findOne({ where: { id } });
        if (!shipment) throw new HttpException('Shipment not found.', HttpStatus.NOT_FOUND);
        return shipment;
    }

    private async recordEvent(event: Omit<ShipmentEvent, 'id' | 'createdAt'>): Promise<boolean> {
        return this.insertEventIfNew(this.dataSource.manager, event);
    }

    private async insertEventIfNew(manager: EntityManager, event: Omit<ShipmentEvent, 'id' | 'createdAt'>): Promise<boolean> {
        try {
            await manager.insert(ShipmentEvent, event);
            return true;
        } catch (error: any) {
            if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) return false;
            throw error;
        }
    }

    hash(input: string): string {
        return createHash('sha256').update(input).digest('hex');
    }

    private audit(actor: Actor, action: AuditAction, shipment: Shipment, changedFields: Record<string, { from: any; to: any }>): void {
        this.auditLogService
            .createAsyncLog({
                actorId: actor?.id || actor?.userId || null,
                actorName: actor?.name || null,
                actorEmail: actor?.email || null,
                actorRole: actor?.role || 'admin',
                action,
                module: AuditModule.ORDER,
                targetId: shipment.orderId,
                targetType: AuditTargetType.SHIPMENT,
                status: 'SUCCESS',
                changes: { type: 'FIELD_DIFF', changedFields: { shipmentId: { from: null, to: shipment.id }, ...changedFields } }
            })
            .catch(() => undefined);
    }
}
