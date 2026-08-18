import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { User } from 'src/module/user/entities/user.entity';

@Entity('orders')
export class Orders extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    orderId: string;

    @Column({ type: 'varchar', nullable: false })
    userId: string;

    @Column({ type: 'varchar', nullable: false })
    paymentIntentId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    totalAmount: number;

    @Column({ type: 'varchar', nullable: false })
    currency: string;

    @Column({
        type: 'enum',
        enum: OrderStatus,
        default: OrderStatus.FAILED
    })
    status: OrderStatus;
      
    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.UNPAID
    })
    paymentStatus: PaymentStatus;

    @OneToMany(() => OrderSummary, summary => summary.order)
    orderSummaries: OrderSummary[];

    @ManyToOne(() => User, (user) => user.orders)
    @JoinColumn({ name: 'userId' })
    user: User;
}
