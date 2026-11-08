import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { InventoryOutboxEvents, InventoryOutboxStatus } from '../entities/inventory-outbox-event.entity';

@Injectable()
export class InventoryOutboxService {
    private readonly logger = new Logger(InventoryOutboxService.name);
    private isProcessing = false;

    constructor(private readonly dataSource: DataSource) {}

    /**
     * Enqueues an inventory domain event within an active ACID transaction.
     * Guarantees atomic consistency with state mutations.
     */
    async enqueueEvent(
        manager: EntityManager,
        aggregateType: string,
        aggregateId: string,
        eventType: string,
        payload: Record<string, any>
    ): Promise<InventoryOutboxEvents> {
        const repo = manager.getRepository(InventoryOutboxEvents);
        const event = repo.create({
            id: randomUUID(),
            aggregateType,
            aggregateId,
            eventType,
            payload,
            status: InventoryOutboxStatus.PENDING,
            retryCount: 0,
            nextAttemptAt: new Date()
        });
        return await repo.save(event);
    }

    /**
     * Background cron worker to process queued outbox events.
     * Uses pessimistic write with SKIP LOCKED to prevent race conditions across multi-worker instances.
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async processOutbox(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const leaseDurationMs = 60 * 1000;
        const queryRunner = this.dataSource.createQueryRunner();

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            const now = new Date();
            const events = await queryRunner.manager
                .createQueryBuilder(InventoryOutboxEvents, 'outbox')
                .where(
                    '(outbox.status = :pendingStatus AND (outbox.nextAttemptAt <= :now OR outbox.nextAttemptAt IS NULL)) OR ' +
                    '(outbox.status = :processingStatus AND outbox.leaseExpiresAt <= :now)',
                    {
                        pendingStatus: InventoryOutboxStatus.PENDING,
                        processingStatus: InventoryOutboxStatus.PROCESSING,
                        now
                    }
                )
                .orderBy('outbox.createdAt', 'ASC')
                .take(15)
                .setLock('pessimistic_write')
                .setOnLocked('skip_locked')
                .getMany();

            if (events.length === 0) {
                await queryRunner.commitTransaction();
                return;
            }

            const leaseToken = randomUUID();
            const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

            for (const event of events) {
                event.status = InventoryOutboxStatus.PROCESSING;
                event.leaseToken = leaseToken;
                event.leaseExpiresAt = leaseExpiresAt;
                await queryRunner.manager.save(event);
            }

            await queryRunner.commitTransaction();

            // Process each event outside of lock
            for (const event of events) {
                await this.handleSingleEvent(event);
            }
        } catch (err: any) {
            this.logger.error(`[InventoryOutbox] Error during batch processing: ${err?.message}`, err?.stack);
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
        } finally {
            await queryRunner.release();
            this.isProcessing = false;
        }
    }

    private async handleSingleEvent(event: InventoryOutboxEvents): Promise<void> {
        try {
            this.logger.log(`[InventoryOutbox Event Dispatched] [${event.eventType}] ID: ${event.aggregateId}`);
            
            // Event specific business dispatchers (e.g., Courier sync, Low-stock notification)
            if (event.eventType === 'STOCK_LOW_ALERT' || event.eventType === 'STOCK_OUT_ALERT') {
                this.logger.warn(`[STOCK ALERT] Product: ${event.payload?.name || event.aggregateId} is low/out of stock! Remaining: ${event.payload?.quantity}`);
            }

            event.status = InventoryOutboxStatus.COMPLETED;
            event.publishedAt = new Date();
            event.leaseToken = null;
            event.leaseExpiresAt = null;
            await this.dataSource.getRepository(InventoryOutboxEvents).save(event);
        } catch (err: any) {
            this.logger.error(`[InventoryOutbox] Failed to handle event ${event.id}: ${err?.message}`);
            event.retryCount += 1;
            event.status = event.retryCount >= 5 ? InventoryOutboxStatus.FAILED : InventoryOutboxStatus.PENDING;
            event.failureReason = err?.message || 'Unknown processing error';
            event.nextAttemptAt = new Date(Date.now() + Math.min(event.retryCount * 30000, 300000));
            event.leaseToken = null;
            event.leaseExpiresAt = null;
            await this.dataSource.getRepository(InventoryOutboxEvents).save(event);
        }
    }
}
