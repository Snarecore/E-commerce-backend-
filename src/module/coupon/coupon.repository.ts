import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractRepository } from '../../database/abstract.repository';
import { Coupon } from './entity/coupon.entity';

@Injectable()
export class CouponRepository extends AbstractRepository<Coupon> {
    constructor(dataSource: DataSource) {
        super(dataSource, Coupon);
    }
}
