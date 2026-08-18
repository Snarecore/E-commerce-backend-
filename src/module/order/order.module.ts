import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orders } from './entity/order.entity';
import { OrdersController } from './order.controller';
import { OrdersService } from './order.service';
import { OrdersRepository } from './order.repository';
import { UniqueCodeGeneratorService } from '../unique-code-generator/unique-code-generator.service';
import { UniqueCodeGeneratorRepository } from '../unique-code-generator/unique-code-generator.repository';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { VendorSubscriptionRepository } from '../subscription-module/vendor-subscription/vendor-subscription.repository';
import { CommissionRateCmsRepository } from '../subscription-module/commission-rate-cms/commission-rate-cms.repository';
import { ProductRepository } from '../inventory/product/product.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Orders])
	],
	controllers: [OrdersController],
	providers: [
		OrdersService, 
		OrdersRepository, 
		UniqueCodeGeneratorService, 
		UniqueCodeGeneratorRepository, 
		OrderSummaryRepository,
		VendorSubscriptionRepository,
		CommissionRateCmsRepository,
		ProductRepository
	],
	exports: [OrdersService, OrdersRepository]
})

export class OrdersModule {}
