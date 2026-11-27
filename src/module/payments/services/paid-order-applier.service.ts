import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { QueryRunner } from 'typeorm';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { Shipment } from '../../courier/entities/shipment.entity';
import { Orders } from '../../order/entity/order.entity';
import { PaymentRefunds } from '../entities/payment-refund.entity';
import { Payments } from '../entities/payment.entity';
import { PaymentAttemptStatus, RefundStatus } from '../enums/payment.enum';
import { findOrderLines, reserveOrderStock } from '../../order/stock/order-stock';
import { couponUsageOwner, reclaimCouponUsage } from '../../coupon/coupon-usage.ledger';
import { PaidOrderAction, PaidOrderDecision, PaidOrderReviewReason, decidePaidOrderAction } from '../utils/paid-order.policy';
import { PaymentOutboxService } from './payment-outbox.service';

export interface ApplyPaidOrderInput {
    /** Open transaction in which `order` and `payment` are row-locked. */
    queryRunner: QueryRunner;
    order: Orders;
    /** The attempt the gateway confirmed; the caller has already set it to PAID with gateway details. */
    payment: Payments;
    /** Stored on the order as its payment method, e.g. 'SSLCOMMERZ' or 'STRIPE'. */
    gatewayLabel: string;
    /** `updatedBy` for status history, e.g. 'stripe_webhook' or 'sslcommerz_confirmation'. */
    actor: string;
    note: string;
    /** Extra gateway fields for the PAYMENT_CONFIRMED outbox event (tranId, valId, ...). */
    eventDetails?: Record<string, unknown>;
}

export interface ApplyPaidOrderResult {
    outcome: PaymentStatus.PAID | PaymentStatus.REVIEW_REQUIRED;
    decision: PaidOrderDecision;
}

/**
 * Applies a verified, successful payment to its order inside the caller's transaction,
 * following the shared rules in paid-order.policy.ts. Every gateway goes through here so the
 * order side effects (status, stock, courier COD, refunds, outbox) are identical everywhere.
 */
@Injectable()
export class PaidOrderApplier {
    private readonly logger = new Logger(PaidOrderApplier.name);

    async apply(input: ApplyPaidOrderInput): Promise<ApplyPaidOrderResult> {
        const { queryRunner, order } = input;
        let decision = decidePaidOrderAction(order);

        if (decision.action === PaidOrderAction.REVIVE) {
            const lines = await findOrderLines(queryRunner.manager, order);
            const reserved = await reserveOrderStock(queryRunner.manager, lines);
            if (reserved) {
                await reclaimCouponUsage(queryRunner.manager, couponUsageOwner(order));
            } else {
                decision = { action: PaidOrderAction.REVIEW_AND_REFUND, reason: PaidOrderReviewReason.LATE_PAYMENT_STOCK_EXHAUSTED };
            }
        }

        if (decision.action === PaidOrderAction.REVIEW_AND_REFUND) {
            await this.flagForReviewAndRefund(input, decision.reason ?? PaidOrderReviewReason.ORDER_CLOSED);
            return { outcome: PaymentStatus.REVIEW_REQUIRED, decision };
        }

        await this.confirm(input);
        return { outcome: PaymentStatus.PAID, decision };
    }

    private async confirm({ queryRunner, order, payment, gatewayLabel, actor, note, eventDetails }: ApplyPaidOrderInput): Promise<void> {
        if (order.status === OrderStatus.PENDING || order.status === OrderStatus.CANCELLED) {
            order.status = OrderStatus.ORDER_PLACED;
            order.statusHistory = [
                ...(order.statusHistory || []),
                { status: OrderStatus.ORDER_PLACED, timestamp: new Date().toISOString(), updatedBy: actor, note },
            ];
        }
        order.paymentStatus = PaymentStatus.PAID;
        order.paymentMethod = gatewayLabel;

        payment.needsAdminReview = false;
        payment.adminReviewReason = null;

        await queryRunner.manager.save(payment);
        await queryRunner.manager.save(order);

        // Paid online: a shipment booked earlier must no longer collect cash on delivery
        await queryRunner.manager
            .createQueryBuilder()
            .update(Shipment)
            .set({ codAmount: 0 })
            .where('orderId = :orderId OR orderCode = :orderCode', { orderId: order.id, orderCode: order.orderId })
            .execute();

        await PaymentOutboxService.enqueueEvent(queryRunner, 'PAYMENT', payment.id, 'PAYMENT_CONFIRMED', {
            paymentId: payment.id,
            orderId: order.orderId,
            amount: payment.amount,
            currency: payment.currency,
            ...eventDetails,
        });
    }

    private async flagForReviewAndRefund(
        { queryRunner, order, payment }: ApplyPaidOrderInput,
        reason: PaidOrderReviewReason
    ): Promise<void> {
        this.logger.warn(`[Paid Order Review] Payment ${payment.id} on order ${order.orderId} (${order.status}) needs review: ${reason}`);

        payment.needsAdminReview = true;
        payment.adminReviewReason = reason;
        await queryRunner.manager.save(payment);

        // A duplicate capture leaves the order paid by its first payment; otherwise an admin must decide
        if (order.paymentStatus !== PaymentStatus.PAID) {
            order.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
            await queryRunner.manager.save(order);
        }

        await this.createPendingRefund(queryRunner, order, payment, reason);
    }

    /**
     * Queues a refund for every captured payment of an order that an admin cancelled or rejected
     * after it was paid. Each payment is flagged so it shows up in the admin refund queue; the
     * money only moves when an admin processes the refund. Returns how many refunds were queued.
     */
    async queueRefundsForClosedOrder(queryRunner: QueryRunner, order: Orders, reason: string): Promise<number> {
        const captured = await queryRunner.manager.find(Payments, { where: { orderId: order.id, status: PaymentAttemptStatus.PAID } });
        let queued = 0;
        for (const payment of captured) {
            payment.needsAdminReview = true;
            payment.adminReviewReason = reason;
            await queryRunner.manager.save(payment);
            if (await this.createPendingRefund(queryRunner, order, payment, reason)) queued++;
        }
        return queued;
    }

    /** Creates one PENDING refund per payment (idempotent) and announces it on the outbox. */
    private async createPendingRefund(queryRunner: QueryRunner, order: Orders, payment: Payments, reason: string): Promise<boolean> {
        const idempotencyKey = `auto_refund_${payment.id}`;
        const existing = await queryRunner.manager.findOne(PaymentRefunds, { where: { idempotencyKey } });
        if (existing) return false;

        const refund = await queryRunner.manager.save(
            queryRunner.manager.create(PaymentRefunds, {
                paymentId: payment.id,
                refundId: `REF-${order.orderId}-${randomBytes(4).toString('hex')}`,
                amount: payment.amount,
                status: RefundStatus.PENDING,
                reason,
                initiatedBy: 'SYSTEM',
                idempotencyKey,
            })
        );

        await PaymentOutboxService.enqueueEvent(queryRunner, 'REFUND', refund.id, 'REFUND_PENDING', {
            paymentId: payment.id,
            orderId: order.orderId,
            amount: payment.amount,
            reason,
        });
        return true;
    }
}
