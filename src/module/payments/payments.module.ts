import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { VendorSubscriptionService } from '../subscription-module/vendor-subscription/vendor-subscription.service';
import { VendorSubscriptionModule } from '../subscription-module/vendor-subscription/vendor-subscription.module';
import { SubscriptionTierModule } from '../subscription-module/subscription-tier/subscription-tier.module';

@Module({
	imports: [
		VendorSubscriptionModule,
		SubscriptionTierModule    
	],
	controllers: [PaymentsController],
	providers: [PaymentsService],
	exports: [PaymentsService]
})

export class PaymentsModule { }
