import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { Payments } from './payment.entity';
import { RefundStatus } from '../enums/payment.enum';

@Entity('payment_refunds')
@Index('IDX_payment_refunds_paymentId', ['paymentId'])
@Index('UQ_payment_refunds_refundId', ['refundId'], { unique: true })
@Index('UQ_payment_refunds_idempotency', ['idempotencyKey'], { unique: true })
export class PaymentRefunds extends AbstractEntity {
    @Column({ type: 'uuid', nullable: false })
    paymentId: string;

    @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
    refundId: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    gatewayRefundId: string | null;

    @Column({
        type: 'decimal',
        precision: 10,
        scale: 2,
        nullable: false,
        transformer: {
            to: (val: string | number) => val,
            from: (val: string) => (val !== null && val !== undefined ? String(val) : '0.00')
        }
    })
    amount: string;

    @Column({
        type: 'enum',
        enum: RefundStatus,
        default: RefundStatus.PENDING
    })
    status: RefundStatus;

    @Column({ type: 'varchar', length: 255, nullable: false })
    reason: string;

    @Column({ type: 'text', nullable: true })
    failureReason: string | null;

    @Column({ type: 'varchar', length: 50, default: 'SYSTEM' })
    initiatedBy: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    initiatedByUserId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
    idempotencyKey: string;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date | null;

    @ManyToOne(() => Payments, (payment) => payment.refunds, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'paymentId' })
    payment: Payments;
}
