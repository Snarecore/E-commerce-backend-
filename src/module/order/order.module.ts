import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orders } from './entity/order.entity';
import { OrdersController } from './order.controller';
import { OrdersService } from './order.service';
import { OrdersRepository } from './order.repository';
import { UniqueCodeGeneratorService } from '../unique-code-generator/unique-code-generator.service';
import { UniqueCodeGeneratorRepository } from '../unique-code-generator/unique-code-generator.repository';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { ProductRepository } from '../inventory/product/product.repository';
import { CouponModule } from '../coupon/coupon.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Orders]),
		NotificationModule,
		CouponModule
	],
	controllers: [OrdersController],
	providers: [
		OrdersService, 
		OrdersRepository, 
		UniqueCodeGeneratorService, 
		UniqueCodeGeneratorRepository, 
		OrderSummaryRepository,
		ProductRepository
	],
	exports: [OrdersService, OrdersRepository]
})

export class OrdersModule {}
