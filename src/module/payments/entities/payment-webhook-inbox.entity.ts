import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PaymentGateway, InboxStatus } from '../enums/payment.enum';

@Entity('payment_webhook_inbox')
@Index('UQ_payment_webhook_inbox_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_payment_webhook_inbox_processing', ['status', 'nextAttemptAt', 'leaseExpiresAt'])
export class PaymentWebhookInbox {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: PaymentGateway,
        default: PaymentGateway.SSLCOMMERZ
    })
    gateway: PaymentGateway;

    @Column({ type: 'varchar', length: 100, nullable: false })
    eventType: string;

    @Column({ type: 'json', nullable: false })
    payload: Record<string, any>;

    @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
    idempotencyKey: string;

    @Column({
        type: 'enum',
        enum: InboxStatus,
        default: InboxStatus.PENDING
    })
    status: InboxStatus;

    @Column({ type: 'int', default: 0 })
    retryCount: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    leaseToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    leaseExpiresAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    nextAttemptAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    processedAt: Date | null;

    @Column({ type: 'text', nullable: true })
    failureReason: string | null;

    @CreateDateColumn({ type: 'timestamp', precision: 6 })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', precision: 6 })
    updatedAt: Date;
}
