import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncompleteCheckout } from './entities/incomplete-checkout.entity';
import { CheckoutRecoveryActivity } from './entities/checkout-recovery-activity.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { OrdersModule } from '../order/order.module';
import { IncompleteCheckoutService } from './incomplete-checkout.service';
import { IncompleteCheckoutController } from './incomplete-checkout.controller';
import { IncompleteCheckoutLifecycleWorker } from './workers/incomplete-checkout-lifecycle.worker';

@Module({
    imports: [
        TypeOrmModule.forFeature([IncompleteCheckout, CheckoutRecoveryActivity, Product]),
        OrdersModule,
    ],
    controllers: [IncompleteCheckoutController],
    providers: [IncompleteCheckoutService, IncompleteCheckoutLifecycleWorker],
    exports: [IncompleteCheckoutService],
})
export class IncompleteCheckoutModule {}
