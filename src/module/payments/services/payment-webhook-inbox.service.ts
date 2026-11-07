import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual, Or, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { PaymentWebhookInbox } from '../entities/payment-webhook-inbox.entity';
import { PaymentGateway, InboxStatus, PaymentEventSource } from '../enums/payment.enum';
import { PaymentConfirmationService } from './payment-confirmation.service';

@Injectable()
export class PaymentWebhookInboxService {
    private readonly logger = new Logger(PaymentWebhookInboxService.name);
    private isProcessing = false;

    constructor(
        private readonly dataSource: DataSource,
        private readonly paymentConfirmationService: PaymentConfirmationService
    ) {}

    /**
     * Fast-ACK Ingest: Persists incoming raw webhook into durable inbox table in < 2ms.
     * Prevents synchronous lock bloat and survives gateway retries.
     */
    async ingestWebhook(
        gateway: PaymentGateway,
        eventType: string,
        payload: any
    ): Promise<{ queued: boolean; idempotencyKey: string; message: string }> {
        const inboxRepo = this.dataSource.getRepository(PaymentWebhookInbox);

        // Build deterministic idempotency key
        const tranId = payload?.tran_id || '';
        const valId = payload?.val_id || '';
        const rawKey = `${gateway}:${eventType}:${tranId}:${valId}:${payload?.status || ''}`;
        const idempotencyKey = crypto.createHash('sha256').update(rawKey).digest('hex');

        try {
            const inboxRecord = inboxRepo.create({
                gateway,
                eventType,
                payload,
                idempotencyKey,
                status: InboxStatus.PENDING,
                retryCount: 0,
                nextAttemptAt: new Date()
            });

            await inboxRepo.save(inboxRecord);
            this.logger.log(`[Webhook Inbox Ingest] Successfully queued webhook for tranId "${tranId}". Key: ${idempotencyKey.slice(0, 10)}...`);

            return { queued: true, idempotencyKey, message: 'Webhook queued for processing' };
        } catch (err: any) {
            // If duplicate idempotency key exists, return idempotent fast-ACK
            if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate entry')) {
                this.logger.log(`[Webhook Inbox Ingest] Duplicate webhook ignored for tranId "${tranId}". Fast-ACK returned.`);
                return { queued: true, idempotencyKey, message: 'Duplicate webhook already queued (idempotent)' };
            }
            this.logger.error(`[Webhook Inbox Ingest Error] Failed to queue webhook: ${err?.message}`);
            throw err;
        }
    }

    /**
     * Non-blocking 4-Step Worker Pipeline with Fencing Lease Token & Dead-Letter Handling.
     * Runs every 10 seconds.
     */
    @Cron(CronExpression.EVERY_10_SECONDS)
    async processInbox(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const inboxRepo = this.dataSource.getRepository(PaymentWebhookInbox);
            const now = new Date();

            // 1. Claim Batch of candidate items (PENDING or expired LEASE)
            const candidates = await inboxRepo
                .createQueryBuilder('inbox')
                .where(
                    `(inbox.status = :pendingStatus AND (inbox.nextAttemptAt <= :now OR inbox.nextAttemptAt IS NULL)) OR ` +
                    `(inbox.status = :processingStatus AND inbox.leaseExpiresAt < :now)`,
                    {
                        pendingStatus: InboxStatus.PENDING,
                        processingStatus: InboxStatus.PROCESSING,
                        now
                    }
                )
                .orderBy('inbox.createdAt', 'ASC')
                .take(10)
                .getMany();

            if (candidates.length === 0) return;

            for (const item of candidates) {
                await this.processInboxItem(item);
            }
        } catch (err: any) {
            this.logger.error(`[Webhook Inbox Worker Error] ${err?.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Executes the 4-step processing pipeline for a single claimed inbox item.
     */
    async processInboxItem(item: PaymentWebhookInbox): Promise<void> {
        const inboxRepo = this.dataSource.getRepository(PaymentWebhookInbox);
        const leaseToken = randomUUID();
        const leaseDurationMs = 60 * 1000; // 60 seconds lease
        const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

        // Step 1: Claim Lease (Fencing Token)
        const claimResult = await inboxRepo
            .createQueryBuilder()
            .update(PaymentWebhookInbox)
            .set({
                status: InboxStatus.PROCESSING,
                leaseToken,
                leaseExpiresAt
            })
            .where('id = :id AND (leaseToken = :currentLease OR leaseToken IS NULL OR leaseExpiresAt < :now)', {
                id: item.id,
                currentLease: item.leaseToken || '',
                now: new Date()
            })
            .execute();

        if (claimResult.affected === 0) {
            // Another worker claimed this item in the meantime
            return;
        }

        const payload = item.payload || {};
        const valId = payload.val_id;
        const tranId = payload.tran_id;

        try {
            // Step 2 & 3: Delegate to PaymentConfirmationService (zero DB lock during validation API call)
            if (valId && tranId) {
                await this.paymentConfirmationService.confirmPayment(
                    valId,
                    tranId,
                    PaymentEventSource.IPN,
                    payload
                );
            }

            // Step 4: Fencing Token Verification & Completion Commit
            const completeResult = await inboxRepo
                .createQueryBuilder()
                .update(PaymentWebhookInbox)
                .set({
                    status: InboxStatus.PROCESSED,
                    processedAt: new Date(),
                    failureReason: null
                })
                .where('id = :id AND leaseToken = :leaseToken', {
                    id: item.id,
                    leaseToken
                })
                .execute();

            if (completeResult.affected === 0) {
                this.logger.warn(`[Webhook Inbox Lease Expired] Item ${item.id} took longer than 60s lease window.`);
            }
        } catch (err: any) {
            const nextRetryCount = (item.retryCount || 0) + 1;
            const maxRetries = 5;

            // Exponential backoff with jitter: 2^retries * 1000ms + [0..1000ms]
            const jitterMs = Math.floor(Math.random() * 1000);
            const backoffMs = Math.pow(2, nextRetryCount) * 1000 + jitterMs;
            const nextAttemptAt = new Date(Date.now() + backoffMs);

            const isDeadLetter = nextRetryCount >= maxRetries;
            const targetStatus = isDeadLetter ? InboxStatus.DEAD_LETTER : InboxStatus.PENDING;

            await inboxRepo.update(item.id, {
                status: targetStatus,
                retryCount: nextRetryCount,
                nextAttemptAt,
                leaseToken: null,
                leaseExpiresAt: null,
                failureReason: err?.message || 'Processing failed'
            });

            this.logger.warn(
                `[Webhook Inbox Processing Failed] Item ${item.id} attempt ${nextRetryCount}/${maxRetries}. Target: ${targetStatus}. Error: ${err?.message}`
            );
        }
    }
}
