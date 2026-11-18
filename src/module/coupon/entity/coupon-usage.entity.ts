import { AbstractEntity } from '../../../database/abstract.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../../user/entities/user.entity';

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

    /**
     * Human-readable order number (`orders.orderId`, e.g. BB123456), not `orders.id`.
     * Written before the order row exists, so it deliberately has no foreign key.
     */
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
}
