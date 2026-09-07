import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventEntity, OutboxStatusEnum } from '../entity/outbox-event.entity';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(private readonly dataSource: DataSource) {}

  async processPendingEvents(batchSize: number = 50) {
    await this.recoverStuckLeases();

    const eventsToPublish = await this.claimEventsPhase1(batchSize);
    if (eventsToPublish.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const event of eventsToPublish) {
      try {
        await this.publishEventPhase2(event);
        await this.completeEventPhase3(event.id);
        processed++;
      } catch (error: any) {
        this.logger.error(`Failed to publish outbox event ${event.id}: ${error.message}`);
        await this.failEventPhase3(event.id, event.attemptCount, error.message);
        failed++;
      }
    }

    return { processed, failed };
  }

  private async recoverStuckLeases(): Promise<void> {
    await this.dataSource.query(
      `UPDATE outbox_events
       SET status = 'PENDING',
           lease_until = NULL,
           updated_at = NOW()
       WHERE status = 'PROCESSING' AND lease_until < NOW()`
    );
  }

  private async claimEventsPhase1(batchSize: number): Promise<OutboxEventEntity[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const leaseUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 minute lease

      const events = await queryRunner.manager
        .createQueryBuilder(OutboxEventEntity, 'oe')
        .where('oe.status = :status AND oe.availableAt <= NOW()', { status: OutboxStatusEnum.PENDING })
        .orderBy('oe.createdAt', 'ASC')
        .take(batchSize)
        .setLock('pessimistic_write', undefined, ['SKIP LOCKED'])
        .getMany();

      if (events.length === 0) {
        await queryRunner.commitTransaction();
        return [];
      }

      const eventIds = events.map((e: OutboxEventEntity) => e.id);
      await queryRunner.manager
        .createQueryBuilder()
        .update(OutboxEventEntity)
        .set({
          status: OutboxStatusEnum.PROCESSING,
          leaseUntil,
          attemptCount: () => 'attempt_count + 1',
        })
        .whereInIds(eventIds)
        .execute();

      await queryRunner.commitTransaction();
      return events;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async publishEventPhase2(event: OutboxEventEntity): Promise<void> {
    this.logger.log(`[Outbox Publisher] Event ${event.eventType} [${event.eventKey}] published to broker.`);
    // Real webhook / SQS / Kafka publishing invocation
  }

  private async completeEventPhase3(eventId: string): Promise<void> {
    await this.dataSource.getRepository(OutboxEventEntity).update(
      { id: eventId, status: OutboxStatusEnum.PROCESSING },
      {
        status: OutboxStatusEnum.PROCESSED,
        leaseUntil: null,
        processedAt: new Date(),
      }
    );
  }

  private async failEventPhase3(eventId: string, attemptCount: number, errorMessage: string): Promise<void> {
    const MAX_ATTEMPTS = 10;
    if (attemptCount >= MAX_ATTEMPTS) {
      await this.dataSource.getRepository(OutboxEventEntity).update(
        { id: eventId },
        {
          status: OutboxStatusEnum.FAILED,
          leaseUntil: null,
          lastError: errorMessage,
        }
      );
      this.logger.error(`Outbox event ${eventId} reached max attempts (${MAX_ATTEMPTS}) and is marked FAILED.`);
    } else {
      const backoffSeconds = Math.min(300, Math.pow(2, attemptCount) * 5);
      const availableAt = new Date(Date.now() + backoffSeconds * 1000);
      await this.dataSource.getRepository(OutboxEventEntity).update(
        { id: eventId },
        {
          status: OutboxStatusEnum.PENDING,
          leaseUntil: null,
          availableAt,
          lastError: errorMessage,
        }
      );
    }
  }
}
