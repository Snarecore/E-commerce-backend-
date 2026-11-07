import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Get,
    Query,
    Param,
    Req,
    Res,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { CONFIG } from '../../utils/config';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { SslcommerzInitDto } from './dto/sslcommerz-init.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { PaymentsService } from './payments.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
import { PaymentWebhookInboxService } from './services/payment-webhook-inbox.service';
import { PaymentEventSource, PaymentGateway } from './enums/payment.enum';

interface RequestWithRawBody extends Request {
    rawBody?: Buffer;
    user?: any;
}

@Controller({ path: 'payments', version: CONFIG.API_VERSION })
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly paymentConfirmationService: PaymentConfirmationService,
        private readonly paymentWebhookInboxService: PaymentWebhookInboxService,
        private readonly configService: ConfigService
    ) {}

    private getFrontendBaseUrl(): string {
        return (
            this.configService.get<string>('FRONTEND_PUBLIC_URL') ||
            process.env.FRONTEND_PUBLIC_URL ||
            'http://localhost:3000'
        );
    }

    // ==========================================
    // Stripe Endpoints (Preserved for compatibility)
    // ==========================================

    @Public()
    @Post()
    async createPayment(
        @Body() body: any
    ): Promise<{ clientSecret: string; amount?: number }> {
        return this.paymentsService.createPayment(body);
    }

    @Public()
    @Post('create-checkout-session')
    async createCheckoutSession(
        @Body() dto: CreateCheckoutSessionDto
    ): Promise<{ url: string; sessionId: string; orderId: string }> {
        return this.paymentsService.createCheckoutSession(dto);
    }

    /**
     * Initializes a Stripe payment attempt for a given pre-created order (Order-First flow).
     * Enforces single active attempt policy and attempt-specific idempotency keys.
     */
    @Public()
    @Post('stripe/init')
    async initiateStripe(
        @Body() body: { orderId: string },
        @Req() req: RequestWithRawBody
    ): Promise<{ clientSecret: string; orderId: string; tranId: string }> {
        if (!body?.orderId) {
            throw new BadRequestException('orderId is required to initialize Stripe payment.');
        }
        return this.paymentsService.initiateStripePayment(body.orderId, req.user);
    }

    @Public()
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Req() req: RequestWithRawBody,
        @Headers('stripe-signature') signature: string
    ): Promise<{ received: boolean }> {
        if (!signature) {
            throw new BadRequestException('Missing stripe-signature header');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException(
                'Raw body missing. Ensure NestFactory rawBody: true is enabled.'
            );
        }

        return this.paymentsService.handleWebhookEvent(rawBody, signature);
    }

    // ==========================================
    // SSLCommerz Endpoints
    // ==========================================

    /**
     * Initializes an SSLCommerz payment attempt for a given order.
     */
    @Public()
    @Post('sslcommerz/init')
    async initiateSslcommerz(
        @Body() dto: SslcommerzInitDto,
        @Req() req: RequestWithRawBody
    ): Promise<{ gatewayPageUrl: string; tranId: string; orderId: string }> {
        return this.paymentsService.initiateSslcommerzPayment(dto, req.user);
    }

    /**
     * Browser Success Callback from SSLCommerz.
     * Validates payment and safely redirects user's browser back to Next.js order-confirmation page.
     */
    @Public()
    @Post('sslcommerz/success')
    async handleSslcommerzSuccess(
        @Body() body: any,
        @Res() res: Response
    ): Promise<void> {
        const valId = body?.val_id;
        const tranId = body?.tran_id;
        const frontendUrl = this.getFrontendBaseUrl();

        if (!valId || !tranId) {
            res.redirect(303, `${frontendUrl}/cart?error=missing_payment_parameters`);
            return;
        }

        try {
            const result = await this.paymentConfirmationService.confirmPayment(
                valId,
                tranId,
                PaymentEventSource.BROWSER_CALLBACK,
                body
            );

            const targetOrderId = result.humanOrderId || result.orderId || tranId;
            res.redirect(303, `${frontendUrl}/order-confirmation/${targetOrderId}?payment=success`);
        } catch {
            res.redirect(303, `${frontendUrl}/order-confirmation/${tranId}?payment=processing_or_review`);
        }
    }

    /**
     * Browser Failure Callback from SSLCommerz.
     */
    @Public()
    @Post('sslcommerz/fail')
    async handleSslcommerzFail(
        @Body() body: any,
        @Res() res: Response
    ): Promise<void> {
        const tranId = body?.tran_id;
        const frontendUrl = this.getFrontendBaseUrl();
        let targetId = tranId || '';

        if (tranId) {
            const failResult = await this.paymentConfirmationService.handleFailedAttempt(
                { tranId } as any,
                body,
                PaymentEventSource.BROWSER_CALLBACK
            );
            if (failResult?.humanOrderId) {
                targetId = failResult.humanOrderId;
            } else if (failResult?.orderId) {
                targetId = failResult.orderId;
            }
        }

        res.redirect(303, `${frontendUrl}/order-confirmation/${targetId}?payment=failed`);
    }

    /**
     * Browser Cancel Callback from SSLCommerz.
     */
    @Public()
    @Post('sslcommerz/cancel')
    async handleSslcommerzCancel(
        @Body() body: any,
        @Res() res: Response
    ): Promise<void> {
        const tranId = body?.tran_id;
        const frontendUrl = this.getFrontendBaseUrl();
        let targetId = tranId || '';

        if (tranId) {
            const cancelResult = await this.paymentConfirmationService.handleCancelledAttempt(
                tranId,
                PaymentEventSource.BROWSER_CALLBACK,
                body
            );
            if (cancelResult?.humanOrderId) {
                targetId = cancelResult.humanOrderId;
            } else if (cancelResult?.orderId) {
                targetId = cancelResult.orderId;
            }
        }

        res.redirect(303, `${frontendUrl}/order-confirmation/${targetId}?payment=cancelled`);
    }

    /**
     * Server-to-Server Asynchronous IPN Webhook from SSLCommerz.
     * Fast-ACK via Durable Webhook Inbox pattern: stores raw webhook and ACKs immediately in < 2ms.
     */
    @Public()
    @Post('sslcommerz/ipn')
    @HttpCode(HttpStatus.OK)
    async handleSslcommerzIpn(@Body() body: any): Promise<{ received: boolean; status: string; idempotencyKey?: string }> {
        const valId = body?.val_id;
        const tranId = body?.tran_id;

        if (!valId || !tranId) {
            throw new BadRequestException('Invalid IPN payload. val_id and tran_id are required.');
        }

        const ingestRes = await this.paymentWebhookInboxService.ingestWebhook(
            PaymentGateway.SSLCOMMERZ,
            'IPN_CALLBACK',
            body
        );

        return { received: true, status: 'QUEUED', idempotencyKey: ingestRes.idempotencyKey };
    }

    /**
     * Dedicated Admin Payment Query Endpoint with pagination, metrics, and multi-field search.
     */
    @Get('admin/all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllPayments(@Query() query: PaymentFilterDto) {
        return this.paymentsService.getAllPayments(query);
    }

    /**
     * Dedicated Admin Payment Metrics Aggregation Endpoint (Separated from list pagination).
     */
    @Get('admin/metrics')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getPaymentMetrics() {
        return this.paymentsService.getPaymentMetrics();
    }

    /**
     * Query all payment attempts for a given order (used by Customer and Admin views).
     */
    @Public()
    @Get('order/:orderId/attempts')
    async getOrderPaymentAttempts(
        @Param('orderId') orderId: string,
        @Req() req: RequestWithRawBody
    ) {
        return this.paymentsService.getPaymentAttemptsByOrder(orderId, req.user);
    }

    /**
     * Customer Payment Retry Endpoint (Zero-trust: amount/details fetched exclusively from server-side order).
     * Revives expired/cancelled orders if stock is available and initiates a fresh gateway session.
     */
    @Public()
    @Post('order/:orderId/retry')
    async retryPayment(
        @Param('orderId') orderId: string,
        @Req() req: RequestWithRawBody
    ) {
        return this.paymentsService.retryPayment(orderId, req.user);
    }

    /**
     * Dedicated Admin Refund Query Endpoint with pagination and search.
     */
    @Get('admin/refunds')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllRefunds(@Query() query: any) {
        return this.paymentsService.getAllRefunds(query);
    }

    /**
     * Dedicated Admin Refund Metrics Aggregation Endpoint (Separated from list pagination).
     */
    @Get('admin/refunds/metrics')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getRefundMetrics() {
        return this.paymentsService.getRefundMetrics();
    }

    /**
     * Admin Initiates Refund for a payment (Full or Partial).
     * Enforces mathematical sum invariant, active refund barrier, and audit logging.
     */
    @Post('admin/refunds/initiate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async initiateAdminRefund(
        @Body() body: { paymentId: string; amount: number; reason: string; idempotencyKey?: string },
        @Req() req: RequestWithRawBody
    ) {
        const adminUserId = req.user?.id || 'admin-system';
        return this.paymentsService.initiateAdminRefund(
            body.paymentId,
            body.amount,
            body.reason || 'Admin initiated refund',
            adminUserId,
            body.idempotencyKey
        );
    }

    /**
     * Admin Action on Refund (MARK_SUCCEEDED, MARK_FAILED).
     */
    @Post('admin/refunds/:refundId/action')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async adminRefundAction(
        @Param('refundId') refundId: string,
        @Body() body: { action: 'MARK_SUCCEEDED' | 'MARK_FAILED'; reason: string },
        @Req() req: RequestWithRawBody
    ) {
        const adminUserId = req.user?.id || 'admin-system';
        return this.paymentsService.adminRefundAction(
            refundId,
            body.action,
            body.reason || 'Admin refund status update',
            adminUserId
        );
    }

    /**
     * Query Payment Audit Logs (Immutable admin and financial action audit trail).
     */
    @Get('admin/audit-logs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAuditLogs(
        @Query('paymentId') paymentId?: string,
        @Query('refundId') refundId?: string,
        @Query('action') action?: string,
        @Query('search') search?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.paymentsService.getAuditLogs({ paymentId, refundId, action, search, page, limit });
    }

    /**
     * Admin Review Action for flagged payments (APPROVE, REJECT, HOLD).
     */
    @Post('admin/:paymentId/review')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async adminReview(
        @Param('paymentId') paymentId: string,
        @Body() body: { action: 'APPROVE' | 'REJECT' | 'HOLD'; reason: string },
        @Req() req: RequestWithRawBody
    ) {
        const adminUserId = req.user?.id || 'admin-system';
        return this.paymentsService.adminReviewAction(
            paymentId,
            body.action,
            body.reason || 'Admin manual review',
            adminUserId
        );
    }

    /**
     * Admin Verified Gateway-First Reconciliation (Zero-lock gateway check -> amount/currency verification -> DB confirmation).
     */
    @Post('admin/:paymentId/reconcile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async adminReconcile(
        @Param('paymentId') paymentId: string,
        @Req() req: RequestWithRawBody
    ) {
        return this.paymentsService.adminVerifiedReconciliation(paymentId, req.user);
    }

    /**
     * Retrieves paginated dead-letter outbox events.
     */
    @Get('admin/outbox/dead-letter')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getOutboxDeadLetterEvents(@Query() query: any) {
        return this.paymentsService.getOutboxDeadLetterEvents(query);
    }

    /**
     * Replays a dead-letter outbox event with atomic conditional check and immutable audit trail.
     */
    @Post('admin/outbox/:eventId/replay')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async replayOutboxEvent(
        @Param('eventId') eventId: string,
        @Req() req: RequestWithRawBody
    ) {
        return this.paymentsService.replayOutboxEvent(eventId, req.user);
    }
}
