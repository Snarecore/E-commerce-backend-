import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { VendorSubscription } from './entity/vendor-subscription.entity';

@Injectable()
export class VendorSubscriptionRepository extends AbstractRepository<VendorSubscription> {
    constructor(dataSource: DataSource) {
        super(dataSource, VendorSubscription);
    }
}
