import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { Orders } from '../../order/entity/order.entity';
import { PaymentAttemptStatus, PaymentGateway, PaymentMethodType } from '../enums/payment.enum';
import { PaymentEvents } from './payment-event.entity';
import { PaymentRefunds } from './payment-refund.entity';

@Entity('payments')
@Index('IDX_payments_orderId', ['orderId'])
@Index('IDX_payments_tranId', ['tranId'], { unique: true })
@Index('IDX_payments_valId', ['valId'], { unique: true })
@Index('IDX_payments_bankTranId', ['bankTranId'])
@Index('IDX_payments_reconciliation', ['gateway', 'status', 'nextCheckAt', 'reconciliationAttempts'])
export class Payments extends AbstractEntity {
    @Column({ type: 'uuid', nullable: false })
    orderId: string;

    @Column({
        type: 'enum',
        enum: PaymentGateway,
        default: PaymentGateway.SSLCOMMERZ
    })
    gateway: PaymentGateway;

    @Column({
        type: 'enum',
        enum: PaymentMethodType,
        default: PaymentMethodType.UNKNOWN
    })
    paymentMethod: PaymentMethodType;

    @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
    tranId: string;

    @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
    valId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    bankTranId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    gatewaySessionId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    gatewayTransactionId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    gatewayReference: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    cardType: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    cardIssuer: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    cardBrand: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    maskedAccountNo: string | null;

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

    @Column({ type: 'varchar', length: 10, default: 'BDT' })
    currency: string;

    @Column({
        type: 'enum',
        enum: PaymentAttemptStatus,
        default: PaymentAttemptStatus.PENDING
    })
    status: PaymentAttemptStatus;

    @Column({ type: 'varchar', length: 100, nullable: true })
    failureCode: string | null;

    @Column({ type: 'text', nullable: true })
    failureReason: string | null;

    @Column({ type: 'timestamp', nullable: true })
    sessionExpiresAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    lastReconciledAt: Date | null;

    @Column({ type: 'int', default: 0 })
    reconciliationAttempts: number;

    @Column({ type: 'timestamp', nullable: true })
    nextCheckAt: Date | null;

    @Column({ type: 'boolean', default: false })
    needsAdminReview: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    adminReviewReason: string | null;

    @ManyToOne(() => Orders, (order) => order.payments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Orders;

    @OneToMany(() => PaymentEvents, (event) => event.payment)
    events: PaymentEvents[];

    @OneToMany(() => PaymentRefunds, (refund) => refund.payment)
    refunds: PaymentRefunds[];
}
