import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';

@Injectable()
export class SubscriptionTierRepository extends AbstractRepository<SubscriptionTier> {
    constructor(dataSource: DataSource) {
        super(dataSource, SubscriptionTier);
    }
}
