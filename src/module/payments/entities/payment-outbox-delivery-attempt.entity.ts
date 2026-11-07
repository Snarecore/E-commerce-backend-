import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('payment_outbox_delivery_attempts')
@Index('IDX_outbox_attempt_event', ['eventId', 'startedAt'])
@Index('IDX_outbox_attempt_worker', ['workerId', 'startedAt'])
export class PaymentOutboxDeliveryAttempt {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: false })
    eventId: string;

    @Column({ type: 'varchar', length: 150, nullable: false })
    workerId: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    leaseToken: string;

    @Column({ type: 'varchar', length: 50, nullable: false, default: 'PROCESSING' })
    status: string; // 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'ABORTED'

    @Column({ type: 'text', nullable: true })
    failureReason: string | null;

    @CreateDateColumn({ type: 'timestamp', precision: 6 })
    startedAt: Date;

    @Column({ type: 'timestamp', precision: 6, nullable: true })
    completedAt: Date | null;
}
