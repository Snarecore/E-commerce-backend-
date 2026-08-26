import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entity/coupon.entity';
import { CouponUsage } from './entity/coupon-usage.entity';
import { CouponRepository } from './coupon.repository';
import { CouponUsageRepository } from './coupon-usage.repository';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { ProductRepository } from '../inventory/product/product.repository';

@Module({
    imports: [TypeOrmModule.forFeature([Coupon, CouponUsage])],
    controllers: [CouponController],
    providers: [CouponService, CouponRepository, CouponUsageRepository, ProductRepository],
    exports: [CouponService, CouponRepository, CouponUsageRepository]
})
export class CouponModule {}
