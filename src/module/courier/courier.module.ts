import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { SteadfastClient } from './providers/steadfast/steadfast.client';
import { ShipmentService } from './services/shipment.service';
import { ShipmentDispatchWorker } from './services/shipment-dispatch.worker';
import { CourierController } from './courier.controller';
import { SteadfastWebhookController } from './steadfast-webhook.controller';
import { OrdersModule } from '../order/order.module';

/**
 * Courier integration. Depends on OrdersModule (one direction only): every order
 * milestone goes through OrdersService.updateOrderStatus.
 */
@Module({
    imports: [TypeOrmModule.forFeature([Shipment, ShipmentEvent]), OrdersModule],
    controllers: [CourierController, SteadfastWebhookController],
    providers: [SteadfastClient, ShipmentService, ShipmentDispatchWorker],
    exports: [ShipmentService]
})
export class CourierModule {}
