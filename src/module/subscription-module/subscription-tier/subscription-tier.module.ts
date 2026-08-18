import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { SubscriptionTierController } from './subscription-tier.controller';
import { SubscriptionTierService } from './subscription-tier.service';
import { SubscriptionTierRepository } from './subscription-tier.repository';

@Module({
    imports: [TypeOrmModule.forFeature([SubscriptionTier])],
    controllers: [SubscriptionTierController],
    providers: [SubscriptionTierService, SubscriptionTierRepository],
    exports: [SubscriptionTierService, SubscriptionTierRepository]
})
export class SubscriptionTierModule { }
