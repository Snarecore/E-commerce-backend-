import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { CouponDiscountType } from 'src/enums/coupon.enum';
import { CouponUsage } from './coupon-usage.entity';

@Entity('coupon')
@Index('UQ_coupon_code', ['code'], { unique: true })
export class Coupon extends AbstractEntity {
    @Column({ type: 'varchar', nullable: false })
    code: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: CouponDiscountType,
        default: CouponDiscountType.PERCENTAGE
    })
    discountType: CouponDiscountType;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    discountValue: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    minOrderAmount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    maxDiscountAmount: number;

    @Column({ type: 'datetime', nullable: true })
    startDate: Date;

    @Column({ type: 'datetime', nullable: true })
    endDate: Date;

    @Column({ type: 'int', nullable: true })
    usageLimit: number;

    @Column({ type: 'int', default: 1 })
    userUsageLimit: number;

    @Column({ type: 'int', default: 0 })
    usageCount: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @OneToMany(() => CouponUsage, usage => usage.coupon)
    usages: CouponUsage[];
}
