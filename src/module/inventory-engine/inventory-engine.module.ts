import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { StockAdjustmentItem } from './entities/stock-adjustment-item.entity';
import { InventoryOutboxEvents } from './entities/inventory-outbox-event.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { Orders } from '../order/entity/order.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { InventoryEngineService } from './services/inventory-engine.service';
import { InventoryOutboxService } from './services/inventory-outbox.service';
import { InventoryEngineController } from './controllers/inventory-engine.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([StockMovement, StockAdjustment, StockAdjustmentItem, Product, Orders, OrderSummary, InventoryOutboxEvents])
    ],
    controllers: [InventoryEngineController],
    providers: [InventoryEngineService, InventoryOutboxService],
    exports: [InventoryEngineService, InventoryOutboxService, TypeOrmModule]
})
export class InventoryEngineModule {}
