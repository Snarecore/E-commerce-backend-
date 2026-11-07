import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In, LessThanOrEqual } from 'typeorm';
import Stripe from 'stripe';
import { Orders } from './entity/order.entity';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { Payments } from '../payments/entities/payment.entity';
import { PaymentAttemptStatus, PaymentGateway } from '../payments/enums/payment.enum';
import { SslcommerzService } from '../payments/services/sslcommerz.service';
import { Product } from '../inventory/product/entities/product.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';

@Injectable()
export class OrderExpiryWorker {
    private readonly logger = new Logger(OrderExpiryWorker.name);
    private stripeClient: Stripe | null = null;

    constructor(
        private readonly dataSource: DataSource,
        private readonly sslcommerzService: SslcommerzService,
        @Optional() private readonly configService?: ConfigService
    ) {}

    private getStripeClient(): Stripe | null {
        if (!this.stripeClient) {
            const secretKey =
                (this.configService && this.configService.get<string>('STRIPE_SECRET_KEY')) ||
                (this.configService && this.configService.get<string>('API_SECRET_KEY')) ||
                process.env.STRIPE_SECRET_KEY ||
                process.env.API_SECRET_KEY;
            if (secretKey) {
                this.stripeClient = new Stripe(secretKey);
            }
        }
        return this.stripeClient;
    }

    /**
     * Singleton cron execution guarded by MySQL Advisory Lock.
     * Enforces strict single-connection lifecycle for GET_LOCK and RELEASE_LOCK in nested try/finally.
     * Runs every 10 minutes.
     */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async handleExpiredOrders(): Promise<void> {
        let queryRunner: any = null;
        let lockAcquired = false;

        try {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();

            // Strict single-connection MySQL Advisory Lock (non-blocking, timeout 0)
            const [lockResult] = await queryRunner.query(
                "SELECT GET_LOCK('order_expiry_worker_lock', 0) AS isLocked"
            );

            lockAcquired = Number(lockResult?.isLocked) === 1;

            if (!lockAcquired) {
                this.logger.debug('[Order Expiry Worker] Another worker holds the advisory lock. Skipping run.');
                return;
            }

            this.logger.log('[Order Expiry Worker] Acquired advisory lock. Scanning candidate expired orders...');

            const now = new Date();
            const orderRepo = this.dataSource.getRepository(Orders);
            const expiredCandidates = await orderRepo.find({
                where: {
                    status: OrderStatus.PENDING,
                    paymentStatus: PaymentStatus.PENDING,
                    orderPaymentExpiresAt: LessThanOrEqual(now),
                    isDeleted: false
                },
                relations: ['payments', 'orderSummaries'],
                take: 20
            });

            if (expiredCandidates.length === 0) return;

            this.logger.log(`[Order Expiry Worker] Found ${expiredCandidates.length} candidate expired order(s).`);

            for (const order of expiredCandidates) {
                await this.processExpiredOrder(order);
            }
        } catch (err: any) {
            this.logger.error(`[Order Expiry Worker Error] ${err?.message}`);
        } finally {
            if (queryRunner) {
                if (lockAcquired) {
                    try {
                        await queryRunner.query("SELECT RELEASE_LOCK('order_expiry_worker_lock')");
                    } catch (releaseErr: any) {
                        this.logger.error(`[Order Expiry Lock Release Error] ${releaseErr?.message}`);
                    }
                }
                await queryRunner.release().catch(() => null);
            }
        }
    }

    /**
     * Processes a single expired candidate order.
     * External Gateway checks are performed with ZERO DB locks.
     */
    async processExpiredOrder(order: Orders): Promise<void> {
        const payments = order.payments || [];

        // 1. If any payment attempt is PAID, do NOT cancel
        if (payments.some((p) => p.status === PaymentAttemptStatus.PAID)) {
            return;
        }

        // 2. If any payment is under review or currently processing, do NOT auto-cancel
        if (payments.some((p) => p.needsAdminReview || p.status === PaymentAttemptStatus.PROCESSING)) {
            this.logger.log(`[Order Expiry] Order ${order.orderId} has payments under review or processing. Skipping auto-cancel.`);
            return;
        }

        // 3. Gateway-Specific Verification (Zero DB locks)
        // Check SSLCommerz attempts
        for (const payment of payments) {
            const isSslcz =
                payment.gateway === PaymentGateway.SSLCOMMERZ ||
                !payment.gateway ||
                payment.tranId?.startsWith('SSLCZ-');

            if (isSslcz && (payment.status === PaymentAttemptStatus.PENDING || payment.status === PaymentAttemptStatus.UNKNOWN)) {
                try {
                    const queryRes = await this.sslcommerzService.queryTransaction(payment.tranId);
                    const element = queryRes?.element?.[0];
                    if (element && (element.status === 'VALID' || element.status === 'VALIDATED')) {
                        this.logger.warn(`[Order Expiry] Order ${order.orderId} payment is VALID on SSLCommerz! Postponing cancellation.`);
                        return; // Postpone cancellation for reconciliation
                    }
                } catch {
                    // Gateway query failed/timed out: Keep order pending for safety
                    this.logger.warn(`[Order Expiry] SSLCommerz query failed/timed out for order ${order.orderId}. Postponing cancellation.`);
                    return;
                }
            }
        }

        // Check Stripe attempts and cancel cancellable intent
        const stripe = this.getStripeClient();
        for (const payment of payments) {
            const isStripe = payment.gateway === PaymentGateway.STRIPE || payment.tranId?.startsWith('pi_');
            const intentId = payment.tranId?.startsWith('pi_') ? payment.tranId : order.paymentIntentId;

            if (isStripe && intentId && intentId.startsWith('pi_') && stripe) {
                try {
                    const intent = await stripe.paymentIntents.retrieve(intentId);
                    if (intent.status === 'succeeded' || intent.status === 'processing') {
                        this.logger.warn(`[Order Expiry] Order ${order.orderId} Stripe intent is ${intent.status}! Postponing cancellation.`);
                        return;
                    }

                    const cancellableStatuses = [
                        'requires_payment_method',
                        'requires_confirmation',
                        'requires_action',
                        'requires_capture'
                    ];

                    if (cancellableStatuses.includes(intent.status)) {
                        const canceledIntent = await stripe.paymentIntents.cancel(intentId);
                        if (canceledIntent.status !== 'canceled') {
                            this.logger.warn(
                                `[Order Expiry] Stripe cancel returned status "${canceledIntent.status}". Expected "canceled". Postponing cancellation.`
                            );
                            return;
                        }
                        this.logger.log(`[Order Expiry] Successfully cancelled Stripe PaymentIntent ${intentId} on gateway.`);
                    }
                } catch (stripeErr: any) {
                    this.logger.warn(
                        `[Order Expiry] Stripe query/cancel error for order ${order.orderId}: ${stripeErr?.message}. Postponing cancellation.`
                    );
                    return;
                }
            }
        }

        // 4. Safe to Cancel & Restock inside DB Transaction with Order Row Lock
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedOrder = await queryRunner.manager.findOne(Orders, {
                where: { id: order.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedOrder || lockedOrder.status !== OrderStatus.PENDING || lockedOrder.paymentStatus === PaymentStatus.PAID) {
                await queryRunner.rollbackTransaction();
                return;
            }

            // Atomic Stock Restock in Strict ASC Primary Key Order
            const summaries = await queryRunner.manager.find(OrderSummary, {
                where: { orderId: lockedOrder.orderId }
            });

            // Aggregate restock requirements by Product ID and Size
            const aggregatedRestock = new Map<string, { totalQty: number; sizeMap: Map<string, number> }>();
            for (const item of summaries) {
                if (!item.productId) continue;
                if (!aggregatedRestock.has(item.productId)) {
                    aggregatedRestock.set(item.productId, { totalQty: 0, sizeMap: new Map() });
                }
                const entry = aggregatedRestock.get(item.productId)!;
                const qty = Number(item.quantity) || 1;
                entry.totalQty += qty;
                const selectedSize = (item as any).size || (item as any).selectedSize || '';
                if (selectedSize) {
                    entry.sizeMap.set(selectedSize, (entry.sizeMap.get(selectedSize) || 0) + qty);
                }
            }

            const sortedProductIds = Array.from(aggregatedRestock.keys()).sort(); // 🔒 Deterministic ASC Clustered-PK Order

            // Sequential Clustered-PK Row Locks in ASC Order and atomic restock
            for (const productId of sortedProductIds) {
                const req = aggregatedRestock.get(productId)!;
                const product = await queryRunner.manager.findOne(Product, {
                    where: { id: productId },
                    lock: { mode: 'pessimistic_write' }
                });

                if (product) {
                    const currentQty = Number(product.quantity) || 0;
                    let updatedSizeStock = product.sizeStock;

                    if (updatedSizeStock && typeof updatedSizeStock === 'object') {
                        updatedSizeStock = { ...updatedSizeStock };
                        for (const [sizeName, restockQty] of req.sizeMap.entries()) {
                            const currentSizeQty = Number(updatedSizeStock[sizeName]) || 0;
                            updatedSizeStock[sizeName] = currentSizeQty + restockQty;
                        }
                    }

                    await queryRunner.manager.update(Product, product.id, {
                        quantity: currentQty + req.totalQty,
                        sizeStock: updatedSizeStock
                    });
                }
            }

            // Atomically mark pending/unknown payments as EXPIRED
            await queryRunner.manager.update(
                Payments,
                { orderId: lockedOrder.id, status: In([PaymentAttemptStatus.PENDING, PaymentAttemptStatus.UNKNOWN]) },
                {
                    status: PaymentAttemptStatus.EXPIRED,
                    failureReason: 'Order payment window expired without completion'
                }
            );

            // Update order status to CANCELLED
            lockedOrder.status = OrderStatus.CANCELLED;
            lockedOrder.paymentStatus = PaymentStatus.UNPAID;

            const nowIso = new Date().toISOString();
            lockedOrder.statusHistory = [
                ...(lockedOrder.statusHistory || []),
                {
                    status: OrderStatus.CANCELLED,
                    timestamp: nowIso,
                    updatedBy: 'system',
                    note: 'Order payment window expired without successful payment. Stock restored.'
                }
            ];

            await queryRunner.manager.save(lockedOrder);
            await queryRunner.commitTransaction();
            this.logger.log(`[Order Expiry] Successfully cancelled expired order ${lockedOrder.orderId} and restocked inventory.`);
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`[Order Expiry Transaction Error] Failed to cancel order ${order.orderId}: ${err?.message}`);
        } finally {
            await queryRunner.release();
        }
    }
}
