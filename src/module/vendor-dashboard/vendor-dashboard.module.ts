import { Module } from '@nestjs/common';
import { JwtModule } from "@nestjs/jwt";
import { JwtConfigService } from "src/configs/jwt.config";
import { VendorDashboardController } from './vendor-dashboard.controller';
import { VendorDashboardService } from './vendor-dashboard.service';
import { OrdersRepository } from '../order/order.repository';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { VendorSubscriptionRepository } from '../subscription-module/vendor-subscription/vendor-subscription.repository';
import { ProductRepository } from '../inventory/product/product.repository';
import { VendorPaymentRequestRepository } from '../subscription-module/vendor-payment-request/vendor-payment-request.repository';

@Module({
    imports: [
        JwtModule.registerAsync({
            useClass: JwtConfigService
        })
    ],
    controllers: [VendorDashboardController],
    providers: [
        VendorDashboardService,
        OrdersRepository,
        OrderSummaryRepository,
        VendorSubscriptionRepository,
        ProductRepository,
        VendorPaymentRequestRepository
    ]
})
export class VendorDashboardModule {}