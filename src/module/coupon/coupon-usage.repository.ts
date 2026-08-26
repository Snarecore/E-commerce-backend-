import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractRepository } from 'src/database/abstract.repository';
import { CouponUsage } from './entity/coupon-usage.entity';

@Injectable()
export class CouponUsageRepository extends AbstractRepository<CouponUsage> {
    constructor(dataSource: DataSource) {
        super(dataSource, CouponUsage);
    }
}
