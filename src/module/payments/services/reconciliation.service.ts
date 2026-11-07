import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In, LessThanOrEqual, QueryRunner } from 'typeorm';
import { Payments } from '../entities/payment.entity';
import { PaymentAttemptStatus, PaymentEventSource, PaymentGateway } from '../enums/payment.enum';
import { SslcommerzService } from './sslcommerz.service';
import { PaymentConfirmationService } from './payment-confirmation.service';

@Injectable()
export class ReconciliationService {
    private readonly logger = new Logger(ReconciliationService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly sslcommerzService: SslcommerzService,
        private readonly paymentConfirmationService: PaymentConfirmationService
    ) {}

    /**
     * Exponential backoff delays in minutes:
     * Retry 1: +5m, Retry 2: +15m, Retry 3: +30m, Retry 4: +60m, Retry 5: +120m
     */
    private getBackoffDelayMinutes(attempt: number): number {
        const delays = [5, 15, 30, 60, 120];
        return delays[Math.min(attempt, delays.length - 1)];
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async reconcilePendingPayments(): Promise<void> {
        let queryRunner: QueryRunner | null = null;
        let lockAcquired = false;

        try {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();

            // 1. Single-worker MySQL Advisory Lock (non-blocking 0 timeout)
            const [lockResult] = await queryRunner.query(
                "SELECT GET_LOCK('sslcommerz_reconciliation_lock', 0) AS isLocked"
            );

            lockAcquired = Number(lockResult?.isLocked) === 1;

            if (!lockAcquired) {
                this.logger.debug('[Reconciliation] Another instance holds the advisory lock. Skipping run.');
                return;
            }

            this.logger.log('[Reconciliation] Acquired lock. Scanning for stuck or pending SSLCommerz payments...');

            const now = new Date();
            const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000); // At least 5 mins old

            // 2. Ordered batch selection with gateway isolation
            const payments = await queryRunner.manager.find(Payments, {
                where: [
                    {
                        gateway: PaymentGateway.SSLCOMMERZ,
                        status: In([PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.UNKNOWN]),
                        createdAt: LessThanOrEqual(stuckThreshold),
                        reconciliationAttempts: LessThanOrEqual(4),
                        nextCheckAt: LessThanOrEqual(now)
                    },
                    {
                        gateway: PaymentGateway.SSLCOMMERZ,
                        status: In([PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.UNKNOWN]),
                        createdAt: LessThanOrEqual(stuckThreshold),
                        reconciliationAttempts: LessThanOrEqual(4),
                        nextCheckAt: undefined
                    }
                ],
                order: { nextCheckAt: 'ASC', createdAt: 'ASC' },
                take: 20
            });

            if (payments.length === 0) {
                this.logger.debug('[Reconciliation] No pending payments eligible for inspection.');
                return;
            }

            this.logger.log(`[Reconciliation] Found ${payments.length} candidate payment(s) to inspect.`);

            for (const payment of payments) {
                await this.inspectPayment(payment, queryRunner);
            }
        } catch (error: any) {
            this.logger.error(`[Reconciliation Job Failed] ${error?.message}`, error?.stack);
        } finally {
            if (queryRunner) {
                if (lockAcquired) {
                    try {
                        await queryRunner.query("SELECT RELEASE_LOCK('sslcommerz_reconciliation_lock')");
                    } catch (releaseErr: any) {
                        this.logger.error(`[Reconciliation Lock Release Error] ${releaseErr?.message}`);
                    }
                }
                await queryRunner.release();
            }
        }
    }

    /**
     * Inspects a single pending payment against SSLCommerz query API.
     */
    private async inspectPayment(payment: Payments, queryRunner: QueryRunner): Promise<void> {
        this.logger.log(`[Reconciliation] Querying gateway for tranId: "${payment.tranId}"`);

        try {
            const queryRes = await this.sslcommerzService.queryTransaction(payment.tranId);
            const element = queryRes?.element?.[0];

            if (element && (element.status === 'VALID' || element.status === 'VALIDATED') && element.val_id) {
                this.logger.log(`[Reconciliation] Gateway confirmed VALID for tranId: "${payment.tranId}". Auto-confirming.`);
                await this.paymentConfirmationService.confirmPayment(
                    element.val_id,
                    payment.tranId,
                    PaymentEventSource.RECONCILIATION_WORKER,
                    element
                );
                return;
            }

            if (element && element.status === 'FAILED') {
                this.logger.warn(`[Reconciliation] Gateway confirmed FAILED for tranId: "${payment.tranId}".`);
                await this.paymentConfirmationService.handleFailedAttempt(
                    payment,
                    element,
                    PaymentEventSource.RECONCILIATION_WORKER
                );
                return;
            }

            if (element && (element.status === 'CANCELLED' || element.status === 'UNATTEMPTED' || element.status === 'EXPIRED')) {
                this.logger.warn(`[Reconciliation] Gateway confirmed ${element.status} for tranId: "${payment.tranId}".`);
                await this.paymentConfirmationService.handleCancelledAttempt(
                    payment.tranId,
                    PaymentEventSource.RECONCILIATION_WORKER,
                    element
                );
                return;
            }

            // Unresolved or still pending on gateway: apply Exponential Backoff
            const nextAttempt = payment.reconciliationAttempts + 1;
            const delayMin = this.getBackoffDelayMinutes(nextAttempt);
            const nextCheckAt = new Date(Date.now() + delayMin * 60 * 1000);

            payment.lastReconciledAt = new Date();
            payment.reconciliationAttempts = nextAttempt;
            payment.nextCheckAt = nextCheckAt;

            if (nextAttempt >= 5) {
                payment.needsAdminReview = true;
                payment.adminReviewReason = 'RECONCILIATION_STUCK';
                this.logger.warn(`[Reconciliation] Max retry limit reached for tranId: "${payment.tranId}". Flagged for admin review.`);
            }

            await queryRunner.manager.save(payment);
        } catch (inspectErr: any) {
            this.logger.error(`[Reconciliation] Error inspecting tranId "${payment.tranId}": ${inspectErr?.message}`);
        }
    }
}
