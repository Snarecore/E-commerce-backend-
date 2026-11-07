import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('payment_audit_logs')
@Index('IDX_payment_audit_logs_paymentId', ['paymentId'])
@Index('IDX_payment_audit_logs_refundId', ['refundId'])
@Index('IDX_payment_audit_logs_action', ['action'])
@Index('IDX_payment_audit_logs_actorId', ['actorId'])
@Index('IDX_payment_audit_logs_createdAt', ['createdAt'])
export class PaymentAuditLogs {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    paymentId: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    refundId: string | null;

    @Column({ type: 'varchar', length: 100, nullable: false })
    action: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    actorId: string;

    @Column({ type: 'varchar', length: 50, nullable: false, default: 'admin' })
    actorRole: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    previousState: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    newState: string | null;

    @Column({ type: 'text', nullable: true })
    reason: string | null;

    @Column({ type: 'json', nullable: true })
    metadata: Record<string, any> | null;

    @CreateDateColumn({ type: 'timestamp', precision: 6 })
    createdAt: Date;
}
