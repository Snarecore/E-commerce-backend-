import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from 'src/module/user/entities/user.entity';
import { Orders } from 'src/module/order/entity/order.entity';

@Entity('coupon_usage')
@Index('IDX_coupon_user', ['couponId', 'userId'])
@Index('IDX_coupon_order', ['couponId', 'orderId'])
export class CouponUsage extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    couponId: string;

    @Column({ type: 'varchar', nullable: false })
    userId: string;

    @Column({ type: 'varchar', nullable: false })
    orderId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
    discountAmount: number;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    usedAt: Date;

    @ManyToOne(() => Coupon, coupon => coupon.usages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'couponId' })
    coupon: Coupon;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Orders, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Orders;
}
