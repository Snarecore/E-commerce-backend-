import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorPaymentRequest } from './entity/vendor-payment-request.entity';
import { VendorPaymentRequestController } from './vendor-payment-request.controller';
import { VendorPaymentRequestService } from './vendor-payment-request.service';
import { OrderSummaryRepository } from 'src/module/order-summary/order-summary.repository';
import { VendorPaymentRequestRepository } from './vendor-payment-request.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { UserProfileRepository } from 'src/module/user-profile/user-profile.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([VendorPaymentRequest])
    ],
    controllers: [VendorPaymentRequestController],
    providers: [
        VendorPaymentRequestService,
        VendorPaymentRequestRepository, 
        OrderSummaryRepository,
        UserProfileRepository,
        SpaceService, 
        R2ServiceProvider
    ],
    exports: [VendorPaymentRequestService, VendorPaymentRequestRepository]
})

export class VendorPaymentRequestModule {}
