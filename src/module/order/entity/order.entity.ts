import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { User } from 'src/module/user/entities/user.entity';

@Entity('orders')
@Index('IDX_orders_orderId', ['orderId'])
@Index('IDX_orders_user_created', ['userId', 'createdAt'])
export class Orders extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    orderId: string;

    @Column({ type: 'varchar', nullable: false })
    userId: string;

    @Column({ type: 'varchar', nullable: true })
    paymentIntentId: string;

    @Column({ type: 'varchar', nullable: true })
    stripeSessionId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    totalAmount: number;

    @Column({ type: 'varchar', nullable: false })
    currency: string;

    @Column({ type: 'varchar', nullable: true, default: 'COD' })
    paymentMethod: string;

    @Column({ type: 'json', nullable: true })
    shippingAddress: any;

    @Column({ type: 'text', nullable: true })
    specialNote: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    subtotal: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    deliveryCharge: number;

    @Column({ type: 'varchar', nullable: true })
    courierName: string;

    @Column({ type: 'varchar', nullable: true })
    trackingId: string;

    @Column({ type: 'varchar', nullable: true })
    courierTrackingLink: string;

    @Column({ type: 'varchar', nullable: true })
    idempotencyKey: string;

    @Column({ type: 'json', nullable: true })
    statusHistory: Array<{
        status: string;
        timestamp: string;
        updatedBy: string;
        updatedByUserId?: string;
        note?: string;
    }>;

    @Column({
        type: 'enum',
        enum: OrderStatus,
        default: OrderStatus.ORDER_PLACED
    })
    status: OrderStatus;
      
    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING
    })
    paymentStatus: PaymentStatus;

    @OneToMany(() => OrderSummary, summary => summary.order)
    orderSummaries: OrderSummary[];

    @ManyToOne(() => User, (user) => user.orders)
    @JoinColumn({ name: 'userId' })
    user: User;
}
