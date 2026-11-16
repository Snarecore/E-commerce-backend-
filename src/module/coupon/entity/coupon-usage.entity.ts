import { AbstractEntity } from '../../../database/abstract.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../../user/entities/user.entity';
import { Orders } from '../../order/entity/order.entity';

@Entity('coupon_usage')
@Index('IDX_coupon_user', ['couponId', 'userId'])
@Index('IDX_coupon_phone', ['couponId', 'phone'])
@Index('IDX_coupon_order', ['couponId', 'orderId'])
export class CouponUsage extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    couponId: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', nullable: false })
    orderId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    discountAmount: number;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    usedAt: Date;

    @ManyToOne(() => Coupon, coupon => coupon.usages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'couponId' })
    coupon: Coupon;

    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User | null;

    @ManyToOne(() => Orders, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Orders;
}
