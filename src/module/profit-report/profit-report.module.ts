import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orders } from '../order/entity/order.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { MainCategory } from '../inventory/main-category/entities/main-category.entity';
import { ProfitReportController } from './profit-report.controller';
import { ProfitReportService } from './profit-report.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Orders, OrderSummary, Product, MainCategory])
    ],
    controllers: [ProfitReportController],
    providers: [ProfitReportService],
    exports: [ProfitReportService]
})
export class ProfitReportModule {}
