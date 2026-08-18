import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorSubscription } from './entity/vendor-subscription.entity';
import { VendorSubscriptionController } from './vendor-subscription.controller';
import { VendorSubscriptionService } from './vendor-subscription.service';
import { VendorSubscriptionRepository } from './vendor-subscription.repository';
import { SubscriptionTierRepository } from '../subscription-tier/subscription-tier.repository';
import { SubscriptionTier } from '../subscription-tier/entities/subscription-tier.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionCronJob } from './subscription-cron.job';

@Module({
    imports: [
        TypeOrmModule.forFeature([VendorSubscription, SubscriptionTier]),
        ScheduleModule.forRoot()
    ],
    controllers: [VendorSubscriptionController],
    providers: [VendorSubscriptionService, VendorSubscriptionRepository, SubscriptionTierRepository, SubscriptionCronJob],
    exports: [VendorSubscriptionService, VendorSubscriptionRepository]
})
export class VendorSubscriptionModule { }
