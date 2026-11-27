import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, VersionColumn } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { CheckoutStatus } from '../enums/checkout-status.enum';
import { User } from '../../user/entities/user.entity';
import { Orders } from '../../order/entity/order.entity';
import { CheckoutRecoveryActivity } from './checkout-recovery-activity.entity';

export interface CartItemSnapshot {
    productId: string;
    variantId?: string | null;
    sku?: string | null;
    /** Selected size, required to deduct per-size stock when the checkout is converted. */
    size?: string | null;
    title: string;
    image?: string | null;
    unitPriceMinor: number;
    quantity: number;
    subtotalMinor: number;
}

@Entity('incomplete_checkouts')
@Index('IDX_incomplete_checkouts_status_lastActivity', ['status', 'lastActivityAt'])
@Index('IDX_incomplete_checkouts_status_createdAt', ['status', 'createdAt'])
@Index('IDX_incomplete_checkouts_customer', ['customerId'])
@Index('IDX_incomplete_checkouts_convertedOrder', ['convertedOrderId'])
@Index('IDX_incomplete_checkouts_expires', ['expiresAt'])
export class IncompleteCheckout extends AbstractEntity {
    @Column({ type: 'varchar', length: 32, unique: true })
    publicCheckoutId: string;

    @Column({ type: 'varchar', length: 64, unique: true })
    sessionTokenHash: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    customerId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'customerId' })
    customer?: User | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    customerName: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    customerPhone: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    customerEmail: string | null;

    @Column({ type: 'text', nullable: true })
    shippingAddress: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    shippingCity: string | null;

    @Column({ type: 'json' })
    cartItemsSnapshot: CartItemSnapshot[];

    @Column({ type: 'varchar', length: 3, default: 'BDT' })
    currency: string;

    @Column({ type: 'bigint', unsigned: true, default: '0' })
    subtotalMinor: string;

    @Column({ type: 'bigint', unsigned: true, default: '0' })
    deliveryFeeMinor: string;

    @Column({ type: 'bigint', unsigned: true, default: '0' })
    discountMinor: string;

    @Column({ type: 'bigint', unsigned: true, default: '0' })
    totalMinor: string;

    @Column({ type: 'varchar', length: 255, default: 'Website checkout' })
    source: string;

    @Column({ type: 'json', nullable: true })
    utmParams: {
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
    } | null;

    @Column({
        type: 'enum',
        enum: CheckoutStatus,
        default: CheckoutStatus.ACTIVE,
    })
    status: CheckoutStatus;

    @Column({ type: 'varchar', length: 36, nullable: true })
    convertedOrderId: string | null;

    @ManyToOne(() => Orders, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'convertedOrderId' })
    convertedOrder?: Orders | null;

    @Column({ type: 'int', unsigned: true, default: 0 })
    recoveryAttemptCount: number;

    @VersionColumn({ default: 1 })
    version: number;

    @Column({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    startedAt: Date;

    @Column({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    lastActivityAt: Date;

    @Column({ type: 'timestamp', precision: 6, nullable: true })
    abandonedAt: Date | null;

    @Column({ type: 'timestamp', precision: 6, nullable: true })
    convertedAt: Date | null;

    @Column({ type: 'timestamp', precision: 6, nullable: true })
    cancelledAt: Date | null;

    @Column({ type: 'timestamp', precision: 6 })
    expiresAt: Date;

    @OneToMany(() => CheckoutRecoveryActivity, (activity) => activity.checkout)
    recoveryActivities: CheckoutRecoveryActivity[];
}
