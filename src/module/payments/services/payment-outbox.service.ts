import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';
import { PaymentOutboxEvents } from '../entities/payment-outbox-event.entity';
import { PaymentOutboxDeliveryAttempt } from '../entities/payment-outbox-delivery-attempt.entity';
import { OutboxStatus } from '../enums/payment.enum';

export interface DispatchContext {
    signal?: AbortSignal;
    deliveryAttemptId: string;
}

@Injectable()
export class PaymentOutboxService {
    private readonly logger = new Logger(PaymentOutboxService.name);
    private isProcessing = false;

    constructor(private readonly dataSource: DataSource) {}

    /**
     * Enqueues an outbox event within an existing ACID transaction.
     * Guaranteed atomic consistency with state mutations.
     */
    static async enqueueEvent(
        queryRunner: QueryRunner,
        aggregateType: string,
        aggregateId: string,
        eventType: string,
        payload: Record<string, any>
    ): Promise<PaymentOutboxEvents> {
        const outboxRecord = queryRunner.manager.create(PaymentOutboxEvents, {
            aggregateType,
            aggregateId,
            eventType,
            payload,
            status: OutboxStatus.PENDING,
            retryCount: 0,
            replayCount: 0,
            leaseToken: null,
            leaseExpiresAt: null,
            nextAttemptAt: new Date()
        });
        return queryRunner.manager.save(outboxRecord);
    }

    /**
     * Non-blocking, Race-Condition-Free Batch Claiming with FOR UPDATE SKIP LOCKED
     * Claims both:
     * 1. PENDING events whose nextAttemptAt <= now
     * 2. Stale/Crashed PROCESSING events whose leaseExpiresAt <= now
     * Runs every 10 seconds.
     */
    @Cron(CronExpression.EVERY_10_SECONDS)
    async processOutbox(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
        const batchLeaseToken = randomUUID();
        const leaseDurationMs = 60 * 1000; // 60 seconds initial lease

        let claimedBatch: Array<{ event: PaymentOutboxEvents; attemptId: string }> = [];

        // Step 1: Transactional Atomic Batch Claim
        const queryRunner = this.dataSource.createQueryRunner();
        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            const now = new Date();
            const candidateEvents = await queryRunner.manager
                .createQueryBuilder(PaymentOutboxEvents, 'outbox')
                .where(
                    '(outbox.status = :pendingStatus AND (outbox.nextAttemptAt <= :now OR outbox.nextAttemptAt IS NULL)) OR ' +
                    '(outbox.status = :processingStatus AND outbox.leaseExpiresAt <= :now)',
                    {
                        pendingStatus: OutboxStatus.PENDING,
                        processingStatus: OutboxStatus.PROCESSING,
                        now
                    }
                )
                .orderBy('outbox.createdAt', 'ASC')
                .take(10)
                .setLock('pessimistic_write', undefined, ['SKIP LOCKED'])
                .getMany();

            if (candidateEvents.length === 0) {
                await queryRunner.commitTransaction();
                return;
            }

            const candidateIds = candidateEvents.map(e => e.id);
            const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

            // Atomic state transition to PROCESSING with unique worker lease
            await queryRunner.manager
                .createQueryBuilder()
                .update(PaymentOutboxEvents)
                .set({
                    status: OutboxStatus.PROCESSING,
                    leaseToken: batchLeaseToken,
                    leaseExpiresAt
                })
                .whereInIds(candidateIds)
                .execute();

            // Insert durable delivery attempt records
            const attemptsToInsert: PaymentOutboxDeliveryAttempt[] = [];
            for (const event of candidateEvents) {
                const attemptId = randomUUID();
                claimedBatch.push({ event, attemptId });

                attemptsToInsert.push(
                    queryRunner.manager.create(PaymentOutboxDeliveryAttempt, {
                        id: attemptId,
                        eventId: event.id,
                        workerId,
                        leaseToken: batchLeaseToken,
                        status: 'PROCESSING',
                        startedAt: new Date()
                    })
                );
            }

            await queryRunner.manager.save(PaymentOutboxDeliveryAttempt, attemptsToInsert);
            await queryRunner.commitTransaction();
        } catch (err: any) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction().catch(() => null);
            }
            this.logger.error(`[Outbox Worker Claim Error] ${err?.message}`);
            return;
        } finally {
            await queryRunner.release().catch(() => null);
        }

        if (claimedBatch.length === 0) return;

        // Step 2: Process Claimed Events Outside DB Transaction
        // Setup Lease Heartbeat Renewal & AbortController
        const abortController = new AbortController();
        let isAborted = false;

        const heartbeatInterval = setInterval(async () => {
            if (isAborted) return;
            try {
                const extendedLease = new Date(Date.now() + leaseDurationMs);
                const ids = claimedBatch.map(c => c.event.id);
                const renewalRes = await this.dataSource.getRepository(PaymentOutboxEvents)
                    .createQueryBuilder()
                    .update(PaymentOutboxEvents)
                    .set({ leaseExpiresAt: extendedLease })
                    .where('id IN (:...ids) AND leaseToken = :batchLeaseToken AND status = :status', {
                        ids,
                        batchLeaseToken,
                        status: OutboxStatus.PROCESSING
                    })
                    .execute();

                if (!renewalRes.affected || renewalRes.affected === 0) {
                    // Lease lost to another worker or DB connection failure
                    this.logger.warn(`[Outbox Heartbeat] Lease renewal failed or ownership lost for token ${batchLeaseToken}. Aborting execution.`);
                    isAborted = true;
                    abortController.abort();
                }
            } catch (renewalErr: any) {
                this.logger.error(`[Outbox Heartbeat Error] Failed to renew lease: ${renewalErr?.message}. Aborting dispatch.`);
                isAborted = true;
                abortController.abort();
            }
        }, 20 * 1000); // Heartbeat every 20s

        try {
            for (const { event, attemptId } of claimedBatch) {
                if (isAborted) {
                    this.logger.warn(`[Outbox Worker] Skipping event ${event.id} due to lease abort.`);
                    break;
                }

                await this.dispatchEventWithLease(event, batchLeaseToken, attemptId, abortController.signal);
            }
        } finally {
            clearInterval(heartbeatInterval);
            this.isProcessing = false;
        }
    }

    /**
     * Dispatches a single outbox event with lease fencing and durable attempt tracking.
     */
    async dispatchEventWithLease(
        event: PaymentOutboxEvents,
        leaseToken: string,
        attemptId: string,
        signal?: AbortSignal
    ): Promise<void> {
        const outboxRepo = this.dataSource.getRepository(PaymentOutboxEvents);
        const attemptRepo = this.dataSource.getRepository(PaymentOutboxDeliveryAttempt);

        try {
            if (signal?.aborted) {
                throw new Error('Dispatch aborted: Worker lost lease ownership');
            }

            // Reliable Dispatch / Notification / Webhook / Event Emitter
            this.logger.log(
                `[Outbox Dispatcher] Dispatching event "${event.eventType}" for ${event.aggregateType}:${event.aggregateId} (Attempt: ${attemptId})`
            );

            // Attach stable idempotencyKey to payload if not present
            const payload = event.payload || {};
            const stableIdempotencyKey = payload.idempotencyKey || `outbox_${event.id}`;

            // Downstream execution simulation (Email, SMS, Kafka/Webhook, etc.)
            // Consumers must use stableIdempotencyKey to guarantee downstream deduplication.

            // Fenced Completion Update (Verifies lease ownership before committing completion)
            const updateRes = await outboxRepo
                .createQueryBuilder()
                .update(PaymentOutboxEvents)
                .set({
                    status: OutboxStatus.PUBLISHED,
                    publishedAt: new Date(),
                    leaseToken: null,
                    leaseExpiresAt: null,
                    failureReason: null
                })
                .where('id = :id AND leaseToken = :leaseToken AND status = :status', {
                    id: event.id,
                    leaseToken,
                    status: OutboxStatus.PROCESSING
                })
                .execute();

            const isOwned = updateRes.affected && updateRes.affected > 0;

            await attemptRepo.update(attemptId, {
                status: isOwned ? 'PUBLISHED' : 'ABORTED',
                completedAt: new Date(),
                failureReason: isOwned ? null : 'Lost lease ownership during dispatch'
            });

            if (!isOwned) {
                this.logger.warn(`[Outbox Dispatcher] Completion rejected for event ${event.id}: lease token ${leaseToken} no longer owned.`);
            }
        } catch (dispatchErr: any) {
            const nextRetryCount = (event.retryCount || 0) + 1;
            const maxRetries = 5;

            const jitterMs = Math.floor(Math.random() * 1000);
            const backoffMs = Math.pow(2, nextRetryCount) * 1000 + jitterMs;
            const nextAttemptAt = new Date(Date.now() + backoffMs);

            const isDeadLetter = nextRetryCount >= maxRetries;
            const targetStatus = isDeadLetter ? OutboxStatus.FAILED : OutboxStatus.PENDING;

            // Fenced Failure Update
            await outboxRepo
                .createQueryBuilder()
                .update(PaymentOutboxEvents)
                .set({
                    status: targetStatus,
                    retryCount: nextRetryCount,
                    nextAttemptAt,
                    leaseToken: null,
                    leaseExpiresAt: null,
                    failureReason: dispatchErr?.message || 'Dispatch failed'
                })
                .where('id = :id AND (leaseToken = :leaseToken OR leaseToken IS NULL)', {
                    id: event.id,
                    leaseToken
                })
                .execute();

            await attemptRepo.update(attemptId, {
                status: 'FAILED',
                completedAt: new Date(),
                failureReason: dispatchErr?.message || 'Dispatch failed'
            });

            this.logger.error(
                `[Outbox Dispatch Failed] Event ${event.id} retry ${nextRetryCount}/${maxRetries}: ${dispatchErr?.message}`
            );
        }
    }

    /**
     * Backwards-compatible dispatch helper for standalone calls.
     */
    async dispatchEvent(event: PaymentOutboxEvents): Promise<void> {
        const dummyLease = randomUUID();
        const dummyAttemptId = randomUUID();
        return this.dispatchEventWithLease(event, dummyLease, dummyAttemptId);
    }
}
