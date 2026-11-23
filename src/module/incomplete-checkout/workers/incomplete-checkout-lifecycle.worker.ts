import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { IncompleteCheckout } from '../entities/incomplete-checkout.entity';
import { CheckoutStatus } from '../enums/checkout-status.enum';

@Injectable()
export class IncompleteCheckoutLifecycleWorker {
    private readonly logger = new Logger(IncompleteCheckoutLifecycleWorker.name);

    constructor(
        private readonly dataSource: DataSource,
        @Optional() private readonly configService?: ConfigService
    ) {}

    /**
     * Singleton cron execution guarded by MySQL Advisory Lock.
     * Transitions inactive checkouts from 'active' to 'abandoned' after inactivity threshold (default 15m),
     * and transitions 'abandoned' to 'expired' when past expiresAt.
     * Runs every 5 minutes.
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCheckoutLifecycle(): Promise<void> {
        let queryRunner: any = null;
        let lockAcquired = false;

        try {
            queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();

            // Strict single-connection MySQL Advisory Lock (non-blocking, timeout 0)
            const [lockResult] = await queryRunner.query(
                "SELECT GET_LOCK('incomplete_checkout_lifecycle_lock', 0) AS isLocked"
            );

            lockAcquired = lockResult && (lockResult.isLocked === 1 || lockResult.isLocked === '1');
            if (!lockAcquired) {
                this.logger.debug('[Lifecycle Worker] Lock acquisition skipped (another instance running).');
                return;
            }

            const inactivityMinutesRaw = this.configService?.get<string>('CHECKOUT_ABANDON_INACTIVITY_MINUTES') || '15';
            const inactivityMinutes = Math.max(5, parseInt(inactivityMinutesRaw, 10) || 15);

            // 1. Transition 'active' -> 'abandoned' atomically
            // Ensures customer who resumes activity simultaneously will not be overwritten due to lastActivityAt condition
            const transitionResult = await queryRunner.manager
                .createQueryBuilder()
                .update(IncompleteCheckout)
                .set({
                    status: CheckoutStatus.ABANDONED,
                    abandonedAt: () => 'CURRENT_TIMESTAMP(6)',
                })
                .where('status = :activeStatus', { activeStatus: CheckoutStatus.ACTIVE })
                .andWhere(`lastActivityAt < DATE_SUB(NOW(), INTERVAL ${inactivityMinutes} MINUTE)`)
                .execute();

            if (transitionResult.affected && transitionResult.affected > 0) {
                this.logger.log(`[Lifecycle Worker] Transitioned ${transitionResult.affected} checkouts from active to abandoned.`);
            }

            // 2. Transition 'abandoned' -> 'expired' atomically
            const expireResult = await queryRunner.manager
                .createQueryBuilder()
                .update(IncompleteCheckout)
                .set({
                    status: CheckoutStatus.EXPIRED,
                })
                .where('status = :abandonedStatus', { abandonedStatus: CheckoutStatus.ABANDONED })
                .andWhere('expiresAt < NOW()')
                .execute();

            if (expireResult.affected && expireResult.affected > 0) {
                this.logger.log(`[Lifecycle Worker] Expired ${expireResult.affected} abandoned checkouts past expiration window.`);
            }
        } catch (error: any) {
            this.logger.error(`[Lifecycle Worker] Error during lifecycle processing: ${error?.message}`, error?.stack);
        } finally {
            if (queryRunner) {
                try {
                    if (lockAcquired) {
                        await queryRunner.query("SELECT RELEASE_LOCK('incomplete_checkout_lifecycle_lock')");
                    }
                } catch (relLockErr: any) {
                    this.logger.error(`[Lifecycle Worker] Failed to release advisory lock: ${relLockErr?.message}`);
                }

                try {
                    await queryRunner.release();
                } catch (relErr: any) {
                    this.logger.error(`[Lifecycle Worker] Failed to release query runner: ${relErr?.message}`);
                }
            }
        }
    }
}
