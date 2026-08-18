import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderSummary } from './entity/order-summary.entity';
import { OrderSummaryRepository } from './order-summary.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrderSummary])
	],
	controllers: [],
	providers: [OrderSummaryRepository],
	exports: [OrderSummaryRepository]
})

export class OrderSummaryModule {}
