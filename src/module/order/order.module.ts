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
import { NotificationModule } from '../notification/notification.module';
import { CouponModule } from '../coupon/coupon.module';
import { MegaDiscountModule } from '../setting/mega-discount/mega-discount.module';
import { SocketModule } from '../socket/socket.module';
import { RiskModule } from '../risk/risk.module';
import { OrderExpiryWorker } from './order-expiry.worker';
import { PaymentsModule } from '../payments/payments.module';
import { EmailServiceModule } from '../email-service/email-sender.module';
import { InventoryEngineModule } from '../inventory-engine/inventory-engine.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Orders]),
		NotificationModule,
		CouponModule,
		MegaDiscountModule,
		SocketModule,
		RiskModule,
		PaymentsModule,
		EmailServiceModule,
		InventoryEngineModule
	],
	controllers: [OrdersController],
	providers: [
		OrdersService, 
		OrdersRepository, 
		UniqueCodeGeneratorService, 
		UniqueCodeGeneratorRepository, 
		OrderSummaryRepository,
		ProductRepository,
		OrderExpiryWorker
	],
	exports: [OrdersService, OrdersRepository]
})

export class OrdersModule {}
