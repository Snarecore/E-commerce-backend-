import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OutboxStatus } from '../enums/payment.enum';

@Entity('payment_outbox_events')
@Index('IDX_payment_outbox_processing', ['status', 'nextAttemptAt', 'leaseExpiresAt'])
@Index('IDX_payment_outbox_aggregate', ['aggregateType', 'aggregateId'])
export class PaymentOutboxEvents {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50, nullable: false })
    aggregateType: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    aggregateId: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    eventType: string;

    @Column({ type: 'json', nullable: false })
    payload: Record<string, any>;

    @Column({
        type: 'enum',
        enum: OutboxStatus,
        default: OutboxStatus.PENDING
    })
    status: OutboxStatus;

    @Column({ type: 'int', default: 0 })
    retryCount: number;

    @Column({ type: 'int', default: 0 })
    replayCount: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    leaseToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    leaseExpiresAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    nextAttemptAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    publishedAt: Date | null;

    @Column({ type: 'text', nullable: true })
    failureReason: string | null;

    @CreateDateColumn({ type: 'timestamp', precision: 6 })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', precision: 6 })
    updatedAt: Date;
}
