import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SslcommerzService } from './services/sslcommerz.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
import { ReconciliationService } from './services/reconciliation.service';
import { Orders } from '../order/entity/order.entity';
import { Payments } from './entities/payment.entity';
import { PaymentEvents } from './entities/payment-event.entity';
import { PaymentRefunds } from './entities/payment-refund.entity';
import { PaymentAuditLogs } from './entities/payment-audit-log.entity';
import { PaymentWebhookInbox } from './entities/payment-webhook-inbox.entity';
import { PaymentOutboxEvents } from './entities/payment-outbox-event.entity';
import { PaymentOutboxDeliveryAttempt } from './entities/payment-outbox-delivery-attempt.entity';
import { PaymentWebhookInboxService } from './services/payment-webhook-inbox.service';
import { PaymentOutboxService } from './services/payment-outbox.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Orders,
            Payments,
            PaymentEvents,
            PaymentRefunds,
            PaymentAuditLogs,
            PaymentWebhookInbox,
            PaymentOutboxEvents,
            PaymentOutboxDeliveryAttempt
        ]),
        ConfigModule
    ],
    controllers: [PaymentsController],
    providers: [
        PaymentsService,
        SslcommerzService,
        PaymentConfirmationService,
        ReconciliationService,
        PaymentWebhookInboxService,
        PaymentOutboxService
    ],
    exports: [
        PaymentsService,
        SslcommerzService,
        PaymentConfirmationService,
        ReconciliationService,
        PaymentWebhookInboxService,
        PaymentOutboxService,
        TypeOrmModule
    ],
})
export class PaymentsModule {}
