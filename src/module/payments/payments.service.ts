import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { Role } from '../../enums/role.enum';
import Stripe from 'stripe';
import { DataSource, In, Repository } from 'typeorm';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { SslcommerzInitDto } from './dto/sslcommerz-init.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { ResponseUtils, ApiResponse } from '../../utils/response.utils';
import { Orders } from '../order/entity/order.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { MegaDiscount } from '../setting/mega-discount/entities/mega-discount.entity';
import { SINGLETON_MEGA_DISCOUNT_ID } from '../setting/mega-discount/mega-discount.repository';
import { ProductPricingResolver } from '../../utils/pricing.engine';
import { Coupon } from '../coupon/entity/coupon.entity';
import { Payments } from './entities/payment.entity';
import { PaymentEvents } from './entities/payment-event.entity';
import { PaymentRefunds } from './entities/payment-refund.entity';
import { PaymentAuditLogs } from './entities/payment-audit-log.entity';
import { PaymentOutboxEvents } from './entities/payment-outbox-event.entity';
import { PaymentAttemptStatus, PaymentEventSource, PaymentGateway, PaymentMethodType, RefundStatus, OutboxStatus } from './enums/payment.enum';
import { SslcommerzService } from './services/sslcommerz.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
import { PaymentOutboxService } from './services/payment-outbox.service';
import { CurrencyUtils } from '../../utils/currency.utils';
import { GatewaySanitizer } from './utils/gateway-sanitizer.util';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Orders)
        private readonly orderRepository: Repository<Orders>,
        private readonly dataSource: DataSource,
        private readonly sslcommerzService: SslcommerzService,
        private readonly paymentConfirmationService: PaymentConfirmationService
    ) {
        const secretKey =
            this.configService.get<string>('STRIPE_SECRET_KEY') ||
            this.configService.get<string>('API_SECRET_KEY') ||
            process.env.STRIPE_SECRET_KEY ||
            process.env.API_SECRET_KEY;

        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY is missing from environment variables');
        }

        this.stripe = new Stripe(secretKey);
    }

    async createPayment(body: {
        products?: Array<{ id?: string; productId?: string; price?: number; quantity?: number }>;
        items?: Array<{ id?: string; productId?: string; price?: number; quantity?: number }>;
        couponCode?: string;
        city?: string;
        currency?: string;
    }): Promise<{ clientSecret: string; amount: number }> {
        const rawItems = body?.items || body?.products || [];
        const productIds = rawItems
            .map((p) => p.productId || p.id)
            .filter(Boolean) as string[];

        if (!productIds || productIds.length === 0) {
            throw new BadRequestException('At least one valid product item is required for payment calculation.');
        }

        // Authoritative DB pricing calculation (Zero trust on client-supplied prices)
        const productRepo = this.dataSource.getRepository(Product);
        const fetchedProducts = await productRepo.find({
            where: { id: In(productIds), isDeleted: false }
        });

        if (fetchedProducts.length !== productIds.length) {
            throw new BadRequestException('One or more products in your cart no longer exist or are inactive.');
        }

        const productMap = new Map(fetchedProducts.map(p => [p.id, p]));

        let megaDiscountRecord: MegaDiscount | null = null;
        try {
            megaDiscountRecord = await this.dataSource.getRepository(MegaDiscount).findOne({
                where: { id: SINGLETON_MEGA_DISCOUNT_ID }
            });
        } catch {
            megaDiscountRecord = null;
        }

        let subtotal = 0;
        for (const item of rawItems) {
            const pid = item.productId || item.id;
            const qty = Math.max(1, Number(item.quantity) || 1);
            const dbProduct = pid ? productMap.get(pid) : null;

            if (!dbProduct) {
                throw new BadRequestException(`Product ID ${pid} could not be verified in the catalog.`);
            }

            const unitPrice = ProductPricingResolver.resolveUnitPrice({
                price: Number(dbProduct.price) || 0,
                discountType: dbProduct.discountType,
                discountAmount: Number(dbProduct.discountAmount) || 0
            }, megaDiscountRecord);
            subtotal += unitPrice * qty;
        }

        // Authoritative delivery fee calculation
        const city = (body.city || '').trim().toLowerCase();
        const isDhaka = city.includes('dhaka');
        const deliveryCharge = rawItems.length > 0 ? (isDhaka ? 60 : 120) : 0;

        // Coupon discount validation
        let discountAmount = 0;
        if (body.couponCode) {
            try {
                const couponRepo = this.dataSource.getRepository(Coupon);
                const coupon = await couponRepo.findOne({
                    where: { code: body.couponCode.trim().toUpperCase(), isDeleted: false }
                });
                if (coupon && coupon.isActive) {
                    const now = new Date();
                    const isExpired = coupon.endDate && new Date(coupon.endDate) < now;
                    if (!isExpired) {
                        if (coupon.discountType === 'PERCENTAGE' as any || String(coupon.discountType).includes('PERCENT')) {
                            discountAmount = (subtotal * Number(coupon.discountValue || 0)) / 100;
                            if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
                                discountAmount = Number(coupon.maxDiscountAmount);
                            }
                        } else if (coupon.discountType === 'FREE_SHIPPING') {
                            discountAmount = deliveryCharge;
                        } else {
                            discountAmount = Number(coupon.discountValue || 0);
                        }
                    }
                }
            } catch {
                discountAmount = 0;
            }
        }

        const amount = Math.max(1, Math.round((subtotal + deliveryCharge - discountAmount + Number.EPSILON) * 100) / 100);

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: (body.currency || 'usd').toLowerCase(),
            payment_method_types: ['card'],
        });

        return { 
            clientSecret: paymentIntent.client_secret ?? '',
            amount
        };
    }

    async createCheckoutSession(
        dto: CreateCheckoutSessionDto
    ): Promise<{ url: string; sessionId: string; orderId: string }> {
        const { userId, items, currency } = dto;

        // Calculate total order amount in base currency
        const totalCents = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
        const totalAmount = totalCents / 100;
        const uniqueOrderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 1. Create order record with PENDING status
        const order = this.orderRepository.create({
            orderId: uniqueOrderId,
            userId,
            totalAmount,
            currency: currency.toLowerCase(),
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
        });
        const savedOrder = await this.orderRepository.save(order);

        try {
            // 2. Create Stripe Checkout Session
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'payment',
                line_items: items.map((item) => ({
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: item.name,
                            description: item.description,
                            images: item.images,
                        },
                        unit_amount: item.unitAmount,
                    },
                    quantity: item.quantity,
                })),
                success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `http://localhost:3000/cancel`,
                metadata: {
                    orderId: savedOrder.id,
                    userId: savedOrder.userId,
                },
            });

            // 3. Update order with stripeSessionId
            savedOrder.stripeSessionId = session.id;
            await this.orderRepository.save(savedOrder);

            return {
                url: session.url ?? '',
                sessionId: session.id,
                orderId: savedOrder.id,
            };
        } catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : String(error);
            savedOrder.status = OrderStatus.FAILED;
            savedOrder.paymentStatus = PaymentStatus.FAILED;
            await this.orderRepository.save(savedOrder);
            this.logger.error(`Stripe checkout creation failed: ${errMessage}`);
            throw new InternalServerErrorException('Failed to create payment checkout session');
        }
    }

    async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
        const webhookSecret =
            this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
            process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
        }

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : String(err);
            this.logger.error(`Webhook Signature Verification Failed: ${errMessage}`);
            throw new BadRequestException(`Webhook Signature Error: ${errMessage}`);
        }

        // Handle webhook events
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.handlePaymentIntentSucceeded(intent);
                break;
            }
            case 'payment_intent.payment_failed': {
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.handlePaymentIntentFailed(intent);
                break;
            }
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await this.handleCheckoutSessionCompleted(session);
                break;
            }
            case 'checkout.session.expired': {
                const session = event.data.object as Stripe.Checkout.Session;
                await this.updateOrderStatusBySession(
                    session,
                    OrderStatus.FAILED,
                    PaymentStatus.FAILED
                );
                break;
            }
            default:
                this.logger.log(`Unhandled webhook event type: ${event.type}`);
        }

        return { received: true };
    }

    /**
     * Authoritative Webhook Confirmation for Stripe payments.
     * Enforces amount/currency minor-unit verification, idempotency, and transactional order confirmation.
     */
    private async handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
        const orderId = intent.metadata?.orderId;
        const attemptId = intent.metadata?.attemptId;

        const orderRepo = this.dataSource.getRepository(Orders);
        const paymentRepo = this.dataSource.getRepository(Payments);

        let order = orderId ? await orderRepo.findOne({ where: [{ id: orderId }, { orderId }] }) : null;
        if (!order && intent.id) {
            order = await orderRepo.findOne({ where: { paymentIntentId: intent.id } });
        }

        if (!order) {
            this.logger.error(`[Stripe Webhook] Order not found for PaymentIntent ${intent.id} (Metadata: ${JSON.stringify(intent.metadata)})`);
            return;
        }

        let payment: Payments | null = null;
        if (attemptId) {
            payment = await paymentRepo.findOne({ where: { id: attemptId } });
        }
        if (!payment && intent.id) {
            payment = await paymentRepo.findOne({ where: { tranId: intent.id } });
        }

        // Short-lived DB Transaction with Row Locks (< 5ms)
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedOrder = await queryRunner.manager.findOne(Orders, {
                where: { id: order.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedOrder) {
                await queryRunner.rollbackTransaction();
                return;
            }

            let lockedPayment = payment
                ? await queryRunner.manager.findOne(Payments, {
                      where: { id: payment.id },
                      lock: { mode: 'pessimistic_write' }
                  })
                : null;

            if (!lockedPayment) {
                // Early Webhook Recovery: create payment attempt on the fly if DB save was interrupted
                lockedPayment = queryRunner.manager.create(Payments, {
                    id: attemptId || randomUUID(),
                    orderId: lockedOrder.id,
                    gateway: PaymentGateway.STRIPE,
                    paymentMethod: PaymentMethodType.VISA,
                    tranId: intent.id,
                    gatewayTransactionId: intent.id,
                    amount: String(Number(lockedOrder.totalAmount || 0).toFixed(2)),
                    currency: (lockedOrder.currency || 'USD').toUpperCase(),
                    status: PaymentAttemptStatus.PENDING,
                    sessionExpiresAt: new Date(Date.now() + 20 * 60 * 1000)
                });
            }

            // Idempotency: If already confirmed as PAID, exit cleanly without duplicate processing
            if (lockedPayment.status === PaymentAttemptStatus.PAID && lockedOrder.paymentStatus === PaymentStatus.PAID) {
                this.logger.log(`[Stripe Webhook] Duplicate webhook for Intent ${intent.id}. Already confirmed.`);
                await queryRunner.rollbackTransaction();
                return;
            }

            // Verify minor-unit amount
            const currency = (lockedOrder.currency || 'USD').toUpperCase();
            const expectedMinor = CurrencyUtils.toMinorUnitsBigInt(String(lockedOrder.totalAmount), currency);
            const actualMinor = BigInt(intent.amount);

            if (expectedMinor !== actualMinor) {
                this.logger.error(
                    `[Security Alert: Amount Mismatch] Order ${lockedOrder.orderId} expected ${expectedMinor} minor units, got ${actualMinor} on Stripe Intent ${intent.id}`
                );
                lockedPayment.needsAdminReview = true;
                lockedPayment.adminReviewReason = 'AMOUNT_MISMATCH';
                lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                await queryRunner.manager.save(lockedPayment);
                await queryRunner.manager.save(lockedOrder);
                await queryRunner.commitTransaction();
                return;
            }

            // Verify currency
            if (intent.currency.toUpperCase() !== currency) {
                this.logger.error(
                    `[Security Alert: Currency Mismatch] Expected ${currency}, got ${intent.currency.toUpperCase()} on Stripe Intent ${intent.id}`
                );
                lockedPayment.needsAdminReview = true;
                lockedPayment.adminReviewReason = 'CURRENCY_MISMATCH';
                lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                await queryRunner.manager.save(lockedPayment);
                await queryRunner.manager.save(lockedOrder);
                await queryRunner.commitTransaction();
                return;
            }

            // Update Payment attempt
            lockedPayment.tranId = intent.id;
            lockedPayment.gatewayTransactionId = intent.id;
            lockedPayment.status = PaymentAttemptStatus.PAID;
            lockedPayment.paidAt = new Date();
            lockedPayment.paymentMethod = PaymentMethodType.VISA;
            lockedPayment.needsAdminReview = false;
            await queryRunner.manager.save(lockedPayment);

            // Update Order
            lockedOrder.status = OrderStatus.ORDER_PLACED;
            lockedOrder.paymentStatus = PaymentStatus.PAID;
            lockedOrder.paymentIntentId = intent.id;

            const nowIso = new Date().toISOString();
            lockedOrder.statusHistory = [
                ...(lockedOrder.statusHistory || []),
                {
                    status: OrderStatus.ORDER_PLACED,
                    timestamp: nowIso,
                    updatedBy: 'stripe_webhook',
                    note: `Payment confirmed via Stripe (Intent: ${intent.id})`
                }
            ];

            await queryRunner.manager.save(lockedOrder);

            // Enqueue Transactional Outbox Event
            await PaymentOutboxService.enqueueEvent(
                queryRunner,
                'PAYMENT',
                lockedPayment.id,
                'PAYMENT_CONFIRMED',
                {
                    paymentId: lockedPayment.id,
                    orderId: lockedOrder.orderId,
                    tranId: intent.id,
                    amount: lockedPayment.amount,
                    currency: lockedPayment.currency
                }
            );

            await queryRunner.commitTransaction();
            this.logger.log(`[Stripe Webhook] Successfully confirmed payment for order ${lockedOrder.orderId} (Intent: ${intent.id})`);
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`[Stripe Webhook Error] ${err?.message}`, err?.stack);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Handles payment_intent.payment_failed from Stripe.
     * Transitions the specific attempt to FAILED without cancelling the order (allowing customer retry).
     * Enforces out-of-order protection: cannot overwrite PAID status.
     */
    private async handlePaymentIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
        const attemptId = intent.metadata?.attemptId;
        const paymentRepo = this.dataSource.getRepository(Payments);

        let payment = attemptId ? await paymentRepo.findOne({ where: { id: attemptId } }) : null;
        if (!payment && intent.id) {
            payment = await paymentRepo.findOne({ where: { tranId: intent.id } });
        }

        if (!payment) return;

        // Out-of-order protection: Once PAID, never transition to FAILED
        if (payment.status === PaymentAttemptStatus.PAID) {
            this.logger.warn(`[Stripe Webhook] Out-of-order failed webhook received for already PAID payment ${payment.id}. Ignoring.`);
            return;
        }

        payment.status = PaymentAttemptStatus.FAILED;
        payment.failureReason = intent.last_payment_error?.message || 'Card payment declined';
        await paymentRepo.save(payment);
        this.logger.log(`[Stripe Webhook] Payment attempt ${payment.id} marked as FAILED: ${payment.failureReason}`);
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
        const orderId = session.metadata?.orderId;
        const stripeSessionId = session.id;

        let order: Orders | null = null;

        if (orderId) {
            order = await this.orderRepository.findOne({ where: { id: orderId } });
        } else if (stripeSessionId) {
            order = await this.orderRepository.findOne({ where: { stripeSessionId } });
        }

        if (!order) {
            this.logger.warn(`Order not found for Stripe session ID: ${stripeSessionId}`);
            return;
        }

        order.status = OrderStatus.COMPLETED;
        order.paymentStatus = PaymentStatus.PAID;
        order.stripeSessionId = stripeSessionId;
        if (session.payment_intent) {
            order.paymentIntentId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent.id;
        }

        await this.orderRepository.save(order);
        this.logger.log(`Order ${order.id} updated to PAID and COMPLETED`);
    }

    private async updateOrderStatusBySession(
        session: Stripe.Checkout.Session,
        status: OrderStatus,
        paymentStatus: PaymentStatus
    ): Promise<void> {
        const orderId = session.metadata?.orderId;
        if (orderId) {
            await this.orderRepository.update({ id: orderId }, { status, paymentStatus });
        }
    }

    /**
     * Order-First Stripe Payment Initialization.
     * Enforces single active attempt policy and attempt-specific idempotency keys.
     * Zero DB lock held during Stripe external API call.
     */
    async initiateStripePayment(
        orderId: string,
        requestUser?: any
    ): Promise<{ clientSecret: string; orderId: string; tranId: string }> {
        const orderRepo = this.dataSource.getRepository(Orders);
        const paymentRepo = this.dataSource.getRepository(Payments);

        const order = await orderRepo.findOne({
            where: [{ id: orderId }, { orderId }],
            relations: ['payments']
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${orderId}`);
        }

        // Ownership verification
        if (order.userId && requestUser) {
            const isUserAdmin = requestUser.role === 'admin';
            const requestUserId = requestUser.id || requestUser.userId;
            if (!isUserAdmin && requestUserId && order.userId !== requestUserId) {
                throw new ForbiddenException('You do not have permission to initiate payments for this order.');
            }
        }

        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('This order is already paid.');
        }

        if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('This order is cancelled and cannot accept new payments.');
        }

        const now = new Date();
        const existingPayments = order.payments || [];

        // Single Active Attempt Policy: Check for active unexpired Stripe attempt (< 20 mins)
        const activeAttempt = existingPayments.find(
            (p) =>
                p.gateway === PaymentGateway.STRIPE &&
                p.status === PaymentAttemptStatus.PENDING &&
                p.sessionExpiresAt &&
                new Date(p.sessionExpiresAt).getTime() > now.getTime()
        );

        if (activeAttempt && activeAttempt.tranId && activeAttempt.tranId.startsWith('pi_')) {
            try {
                // Authenticated retrieval from Stripe (zero plaintext client_secret persisted in DB)
                const existingIntent = await this.stripe.paymentIntents.retrieve(activeAttempt.tranId);
                if (existingIntent && existingIntent.client_secret && existingIntent.status !== 'canceled') {
                    return {
                        clientSecret: existingIntent.client_secret,
                        orderId: order.orderId,
                        tranId: activeAttempt.tranId
                    };
                }
            } catch {
                // Fall through to create fresh attempt if retrieval failed
            }
        }

        // Attempt-First persistence: create local Payments attempt in PENDING state
        const attemptId = randomUUID();
        const uniqueInitTranId = `PENDING_${attemptId}`;
        const sessionExpiresAt = new Date(Date.now() + 20 * 60 * 1000);
        const currency = (order.currency || 'USD').toUpperCase();
        const amountMinor = CurrencyUtils.toMinorUnitsSafeNumber(String(order.totalAmount), currency);

        const paymentAttempt = paymentRepo.create({
            id: attemptId,
            orderId: order.id,
            gateway: PaymentGateway.STRIPE,
            paymentMethod: PaymentMethodType.UNKNOWN,
            tranId: uniqueInitTranId,
            gatewaySessionId: null,
            amount: String(Number(order.totalAmount || 0).toFixed(2)),
            currency,
            status: PaymentAttemptStatus.PENDING,
            sessionExpiresAt,
            nextCheckAt: new Date(Date.now() + 5 * 60 * 1000),
            reconciliationAttempts: 0,
            needsAdminReview: false
        });

        await paymentRepo.save(paymentAttempt);

        // Call Stripe PaymentIntent API with attempt-specific idempotency key
        const idempotencyKey = `stripe_pi_${order.id}_${attemptId}`;
        let paymentIntent: Stripe.PaymentIntent;

        try {
            paymentIntent = await this.stripe.paymentIntents.create(
                {
                    amount: amountMinor,
                    currency: currency.toLowerCase(),
                    metadata: {
                        orderId: order.id,
                        orderNumber: order.orderId,
                        attemptId: attemptId,
                        userId: order.userId || ''
                    }
                },
                { idempotencyKey }
            );
        } catch (stripeErr: any) {
            paymentAttempt.status = PaymentAttemptStatus.FAILED;
            paymentAttempt.failureReason = stripeErr?.message || 'Stripe intent creation failed';
            await paymentRepo.save(paymentAttempt);
            throw new InternalServerErrorException(stripeErr?.message || 'Failed to initialize Stripe payment session.');
        }

        // Link actual PaymentIntent ID to the attempt and order
        paymentAttempt.tranId = paymentIntent.id;
        paymentAttempt.gatewayTransactionId = paymentIntent.id;
        await paymentRepo.save(paymentAttempt);

        order.paymentIntentId = paymentIntent.id;
        await orderRepo.save(order);

        if (!paymentIntent.client_secret) {
            throw new InternalServerErrorException('Stripe client secret was not returned by gateway.');
        }

        return {
            clientSecret: paymentIntent.client_secret,
            orderId: order.orderId,
            tranId: paymentIntent.id
        };
    }

    /**
     * Initiates a new SSLCommerz payment attempt for an existing order.
     * Prevents duplicate sessions if an unexpired session already exists.
     */
    async initiateSslcommerzPayment(
        dto: SslcommerzInitDto,
        requestUser?: any
    ): Promise<{ gatewayPageUrl: string; tranId: string; orderId: string }> {
        const orderRepo = this.dataSource.getRepository(Orders);
        const paymentRepo = this.dataSource.getRepository(Payments);

        const order = await orderRepo.findOne({
            where: [{ id: dto.orderId }, { orderId: dto.orderId }],
            relations: ['payments']
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${dto.orderId}`);
        }

        // 🛡️ Ownership Verification (prevents cross-account session hijacking)
        if (order.userId && requestUser) {
            const isUserAdmin = requestUser.role === 'admin';
            const requestUserId = requestUser.id || requestUser.userId;
            if (!isUserAdmin && requestUserId && order.userId !== requestUserId) {
                throw new ForbiddenException('You do not have permission to initiate payments for this order.');
            }
        }

        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('This order is already paid.');
        }

        if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('This order is cancelled and cannot accept new payments.');
        }

        const now = new Date();
        const existingPayments = order.payments || [];

        // Check if an active unexpired payment session was recently initiated (< 2 mins cooldown)
        const recentAttempt = existingPayments.find(
            (p) =>
                p.status === PaymentAttemptStatus.PENDING &&
                p.createdAt &&
                now.getTime() - new Date(p.createdAt).getTime() < 2 * 60 * 1000
        );
        if (recentAttempt) {
            throw new BadRequestException('A payment session was recently initiated. Please wait 2 minutes before requesting a new payment link.');
        }

        const backendBaseUrl =
            this.configService.get<string>('BACKEND_PUBLIC_URL') ||
            process.env.BACKEND_PUBLIC_URL ||
            'http://localhost:5000/api/v1';

        const successUrl = `${backendBaseUrl}/payments/sslcommerz/success`;
        const failUrl = `${backendBaseUrl}/payments/sslcommerz/fail`;
        const cancelUrl = `${backendBaseUrl}/payments/sslcommerz/cancel`;
        const ipnUrl = `${backendBaseUrl}/payments/sslcommerz/ipn`;

        // Extract customer info from DTO, Order, or shipping address
        const shipping = order.shippingAddress || {};
        const customerName = dto.customerName || shipping.name || (order as any).customerName || 'Valued Customer';
        const customerPhone = dto.customerPhone || shipping.phone || (order as any).customerPhone || (order as any).phone || '01700000000';
        const customerAddress = dto.customerAddress || shipping.address || (order as any).address || 'Dhaka, Bangladesh';
        const customerCity = dto.customerCity || shipping.city || 'Dhaka';

        // Unique Transaction ID per attempt
        const attemptIndex = existingPayments.length + 1;
        const uniqueTranId = `SSLCZ-${order.orderId}-A${attemptIndex}-${Date.now().toString().slice(-4)}`;

        const initParams = {
            tranId: uniqueTranId,
            amount: String(Number(order.totalAmount || 0).toFixed(2)),
            currency: 'BDT',
            customerName,
            customerEmail: (order as any).email || (order as any).customerEmail || 'customer@bazaarbound.com',
            customerPhone,
            customerAddress,
            customerCity,
            orderId: order.orderId,
            successUrl,
            failUrl,
            cancelUrl,
            ipnUrl
        };

        const initRes = await this.sslcommerzService.initiatePaymentSession(initParams);

        if (initRes.status !== 'SUCCESS' || !initRes.gatewayPageUrl) {
            throw new InternalServerErrorException(initRes.failedReason || 'Failed to initialize SSLCommerz gateway session');
        }

        // Save new Payment Attempt record
        const paymentAttempt = paymentRepo.create({
            orderId: order.id,
            gateway: PaymentGateway.SSLCOMMERZ,
            paymentMethod: PaymentMethodType.UNKNOWN,
            tranId: uniqueTranId,
            gatewaySessionId: initRes.sessionKey || null,
            amount: String(Number(order.totalAmount || 0).toFixed(2)),
            currency: 'BDT',
            status: PaymentAttemptStatus.PENDING,
            sessionExpiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 min session window
            nextCheckAt: new Date(Date.now() + 5 * 60 * 1000),
            reconciliationAttempts: 0,
            needsAdminReview: false
        });

        await paymentRepo.save(paymentAttempt);

        // Update order overall payment window if not set (25 min total: 20 min gateway session + 5 min grace)
        if (!order.orderPaymentExpiresAt) {
            order.orderPaymentExpiresAt = new Date(Date.now() + 25 * 60 * 1000);
            await orderRepo.save(order);
        }

        return {
            gatewayPageUrl: initRes.gatewayPageUrl,
            tranId: uniqueTranId,
            orderId: order.orderId
        };
    }

    /**
     * Atomically re-reserves inventory for a cancelled order using strict ASC Clustered-PK row locking.
     */
    private async reReserveOrderStock(queryRunner: any, summaries: OrderSummary[]): Promise<boolean> {
        try {
            const aggregatedMap = new Map<string, { totalQty: number; sizeMap: Map<string, number> }>();
            for (const item of summaries) {
                if (!item.productId) continue;
                if (!aggregatedMap.has(item.productId)) {
                    aggregatedMap.set(item.productId, { totalQty: 0, sizeMap: new Map() });
                }
                const entry = aggregatedMap.get(item.productId)!;
                const qty = Number(item.quantity) || 1;
                entry.totalQty += qty;
                const selectedSize = (item as any).size || (item as any).selectedSize || '';
                if (selectedSize) {
                    entry.sizeMap.set(selectedSize, (entry.sizeMap.get(selectedSize) || 0) + qty);
                }
            }

            const sortedProductIds = Array.from(aggregatedMap.keys()).sort(); // 🔒 Deterministic ASC Clustered-PK Order
            const lockedProductMap = new Map<string, Product>();

            // Sequential Clustered-PK row locks in ASC order
            for (const productId of sortedProductIds) {
                const lockedProduct = await queryRunner.manager.findOne(Product, {
                    where: { id: productId, isDeleted: false },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!lockedProduct) return false;
                lockedProductMap.set(productId, lockedProduct);
            }

            // Verify stock availability
            for (const productId of sortedProductIds) {
                const product = lockedProductMap.get(productId)!;
                const req = aggregatedMap.get(productId)!;

                if (product.quantity !== null && product.quantity !== undefined && Number(product.quantity || 0) < req.totalQty) {
                    return false;
                }

                if (product.sizeStock && typeof product.sizeStock === 'object') {
                    for (const [sizeName, neededQty] of req.sizeMap.entries()) {
                        const currentSizeStock = Number(product.sizeStock[sizeName]) || 0;
                        if (currentSizeStock < neededQty) {
                            return false;
                        }
                    }
                }
            }

            // Deduct stock atomically in same sorted order
            for (const productId of sortedProductIds) {
                const product = lockedProductMap.get(productId)!;
                const req = aggregatedMap.get(productId)!;

                let updatedSizeStock = product.sizeStock;
                if (updatedSizeStock && typeof updatedSizeStock === 'object') {
                    updatedSizeStock = { ...updatedSizeStock };
                    for (const [sizeName, neededQty] of req.sizeMap.entries()) {
                        const currentSizeQty = Number(updatedSizeStock[sizeName]) || 0;
                        updatedSizeStock[sizeName] = Math.max(0, currentSizeQty - neededQty);
                    }
                }

                const newTotalQty = (product.quantity !== null && product.quantity !== undefined)
                    ? Math.max(0, Number(product.quantity || 0) - req.totalQty)
                    : 0;

                await queryRunner.manager.update(Product, product.id, {
                    quantity: newTotalQty,
                    sizeStock: updatedSizeStock
                });
            }

            return true;
        } catch (err: any) {
            this.logger.error(`[Re-reserve Stock Error] ${err?.message}`);
            return false;
        }
    }

    /**
     * Zero-trust Payment Retry Handler.
     * Initiates a fresh SSLCommerz gateway session for an order whose previous attempt failed or expired.
     * Revives CANCELLED orders atomically after re-reserving stock.
     */
    async retryPayment(
        orderId: string,
        requestUser?: any
    ): Promise<{ gatewayPageUrl: string; tranId: string; orderId: string; attemptNumber: number }> {
        const orderRepo = this.dataSource.getRepository(Orders);
        const paymentRepo = this.dataSource.getRepository(Payments);

        const order = await orderRepo.findOne({
            where: [{ id: orderId }, { orderId }],
            relations: ['payments', 'orderSummaries']
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${orderId}`);
        }

        // 1. 🛡️ Ownership Verification (Customers can only retry their own orders; Admins can retry any)
        if (order.userId && requestUser) {
            const isUserAdmin = requestUser.role === Role.ADMIN || requestUser.role === 'admin';
            const requestUserId = requestUser.id || requestUser.userId;
            if (!isUserAdmin && requestUserId && order.userId !== requestUserId) {
                throw new ForbiddenException('You do not have permission to retry payment for this order.');
            }
        }

        // 2. Immutability & Double-Payment Guards
        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('This order is already paid.');
        }

        const existingPayments = order.payments || [];
        if (existingPayments.some((p) => p.status === PaymentAttemptStatus.PAID)) {
            throw new BadRequestException('A confirmed payment already exists for this order.');
        }

        if (existingPayments.some((p) => p.needsAdminReview || p.status === PaymentAttemptStatus.PROCESSING)) {
            throw new BadRequestException('A payment attempt for this order is currently under review or processing. Please wait for confirmation.');
        }

        // 3. Active Session Cooldown Guard (2 minutes)
        const now = new Date();
        const recentAttempt = existingPayments.find(
            (p) =>
                p.status === PaymentAttemptStatus.PENDING &&
                p.createdAt &&
                now.getTime() - new Date(p.createdAt).getTime() < 2 * 60 * 1000
        );
        if (recentAttempt) {
            throw new BadRequestException('A payment attempt was recently initiated. Please wait 2 minutes before requesting a new payment link.');
        }

        // 4. Cancelled Order Recovery & Inventory Pre-check
        if (order.status === OrderStatus.CANCELLED) {
            let summaries = order.orderSummaries;
            if (!summaries || summaries.length === 0) {
                summaries = await this.dataSource.getRepository(OrderSummary).find({
                    where: { orderId: order.orderId }
                });
            }

            if (!summaries || summaries.length === 0) {
                throw new BadRequestException('Cannot retry payment: Order has no items.');
            }

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const lockedOrder = await queryRunner.manager.findOne(Orders, {
                    where: { id: order.id },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!lockedOrder) {
                    throw new NotFoundException(`Order not found: ${order.id}`);
                }

                if (lockedOrder.paymentStatus === PaymentStatus.PAID) {
                    await queryRunner.rollbackTransaction();
                    throw new BadRequestException('This order is already paid.');
                }

                const stockReserved = await this.reReserveOrderStock(queryRunner, summaries);
                if (!stockReserved) {
                    await queryRunner.rollbackTransaction();
                    throw new BadRequestException('Cannot retry payment: One or more items in your order are now out of stock.');
                }

                // Revive order to PENDING and refresh payment expiry window (25 min total)
                lockedOrder.status = OrderStatus.PENDING;
                lockedOrder.paymentStatus = PaymentStatus.PENDING;
                lockedOrder.orderPaymentExpiresAt = new Date(Date.now() + 25 * 60 * 1000);

                const nowIso = new Date().toISOString();
                lockedOrder.statusHistory = [
                    ...(lockedOrder.statusHistory || []),
                    {
                        status: OrderStatus.PENDING,
                        timestamp: nowIso,
                        updatedBy: requestUser?.id || 'customer',
                        note: 'Order revived from CANCELLED state via customer payment retry.'
                    }
                ];

                await queryRunner.manager.save(lockedOrder);
                await queryRunner.commitTransaction();

                order.status = OrderStatus.PENDING;
                order.orderPaymentExpiresAt = lockedOrder.orderPaymentExpiresAt;
            } catch (err: any) {
                await queryRunner.rollbackTransaction();
                throw err;
            } finally {
                await queryRunner.release();
            }
        }

        // 5. Generate Unique Transaction ID per attempt
        const attemptIndex = existingPayments.length + 1;
        const uniqueTranId = `SSLCZ-${order.orderId}-A${attemptIndex}-${Date.now().toString().slice(-4)}`;

        const backendBaseUrl =
            this.configService.get<string>('BACKEND_PUBLIC_URL') ||
            process.env.BACKEND_PUBLIC_URL ||
            'http://localhost:5000/api/v1';

        const successUrl = `${backendBaseUrl}/payments/sslcommerz/success`;
        const failUrl = `${backendBaseUrl}/payments/sslcommerz/fail`;
        const cancelUrl = `${backendBaseUrl}/payments/sslcommerz/cancel`;
        const ipnUrl = `${backendBaseUrl}/payments/sslcommerz/ipn`;

        const shipping = order.shippingAddress || {};
        const customerName = shipping.name || (order as any).customerName || 'Valued Customer';
        const customerPhone = shipping.phone || (order as any).customerPhone || (order as any).phone || '01700000000';
        const customerAddress = shipping.address || (order as any).address || 'Dhaka, Bangladesh';
        const customerCity = shipping.city || 'Dhaka';

        const initParams = {
            tranId: uniqueTranId,
            amount: String(Number(order.totalAmount || 0).toFixed(2)),
            currency: 'BDT',
            customerName,
            customerEmail: (order as any).email || (order as any).customerEmail || 'customer@bazaarbound.com',
            customerPhone,
            customerAddress,
            customerCity,
            orderId: order.orderId,
            successUrl,
            failUrl,
            cancelUrl,
            ipnUrl
        };

        const initRes = await this.sslcommerzService.initiatePaymentSession(initParams);

        if (initRes.status !== 'SUCCESS' || !initRes.gatewayPageUrl) {
            throw new InternalServerErrorException(initRes.failedReason || 'Failed to initialize SSLCommerz gateway session');
        }

        // Persist new Payment Attempt record
        const paymentAttempt = paymentRepo.create({
            orderId: order.id,
            gateway: PaymentGateway.SSLCOMMERZ,
            paymentMethod: PaymentMethodType.UNKNOWN,
            tranId: uniqueTranId,
            gatewaySessionId: initRes.sessionKey || null,
            amount: String(Number(order.totalAmount || 0).toFixed(2)),
            currency: 'BDT',
            status: PaymentAttemptStatus.PENDING,
            sessionExpiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 min gateway session
            nextCheckAt: new Date(Date.now() + 5 * 60 * 1000),
            reconciliationAttempts: 0,
            needsAdminReview: false
        });

        await paymentRepo.save(paymentAttempt);

        // Harmonize order payment expiry window (25 min total: 20 min session + 5 min grace)
        if (!order.orderPaymentExpiresAt || order.orderPaymentExpiresAt < new Date()) {
            order.orderPaymentExpiresAt = new Date(Date.now() + 25 * 60 * 1000);
            await orderRepo.save(order);
        }

        return {
            gatewayPageUrl: initRes.gatewayPageUrl as string,
            tranId: uniqueTranId,
            orderId: order.orderId,
            attemptNumber: attemptIndex
        };
    }

    /**
     * Retrieve all payment attempts and gateway details for a given order (Admin & Customer audit).
     */
    async getPaymentAttemptsByOrder(orderId: string, requestUser?: any): Promise<Payments[]> {
        const orderRepo = this.dataSource.getRepository(Orders);
        const order = await orderRepo.findOne({
            where: [{ id: orderId }, { orderId }]
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${orderId}`);
        }

        // 🛡️ Ownership Verification (Customers can only view their own attempts; Admins can view any)
        if (order.userId && requestUser) {
            const isUserAdmin = requestUser.role === 'admin';
            const requestUserId = requestUser.id || requestUser.userId;
            if (!isUserAdmin && requestUserId && order.userId !== requestUserId) {
                throw new ForbiddenException('Access denied to payment attempts for this order.');
            }
        }

        const paymentRepo = this.dataSource.getRepository(Payments);
        return paymentRepo.find({
            where: [{ orderId: order.id }, { order: { orderId: order.orderId } }],
            relations: ['events', 'refunds'],
            order: { createdAt: 'DESC' }
        });
    }

    /**
     * Dedicated Admin Payment & Transaction query with pagination, metrics, and multi-field search.
     */
    async getAllPayments(dto: PaymentFilterDto): Promise<ApiResponse<any>> {
        const page = Math.max(1, Number(dto.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(dto.limit) || 15));
        const skip = (page - 1) * limit;

        const paymentRepo = this.dataSource.getRepository(Payments);
        const qb = paymentRepo.createQueryBuilder('payment')
            .leftJoinAndSelect('payment.order', 'order')
            .leftJoinAndSelect('order.user', 'user')
            .leftJoinAndSelect('payment.refunds', 'refunds')
            .leftJoinAndSelect('payment.events', 'events');

        if (dto.gateway && dto.gateway !== 'ALL') {
            qb.andWhere('payment.gateway = :gateway', { gateway: dto.gateway });
        }

        if (dto.paymentMethod && dto.paymentMethod !== 'ALL') {
            qb.andWhere('payment.paymentMethod = :paymentMethod', { paymentMethod: dto.paymentMethod });
        }

        if (dto.status && dto.status !== 'ALL') {
            qb.andWhere('payment.status = :status', { status: dto.status });
        }

        if (dto.needsAdminReview !== undefined && dto.needsAdminReview !== '') {
            const isReview = String(dto.needsAdminReview) === 'true';
            qb.andWhere('payment.needsAdminReview = :isReview', { isReview });
        }

        if (dto.search && dto.search.trim()) {
            const term = `%${dto.search.trim()}%`;
            qb.andWhere(
                '(payment.tranId LIKE :term OR payment.valId LIKE :term OR payment.bankTranId LIKE :term OR order.orderId LIKE :term OR JSON_UNQUOTE(JSON_EXTRACT(order.shippingAddress, "$.phone")) LIKE :term OR JSON_UNQUOTE(JSON_EXTRACT(order.shippingAddress, "$.name")) LIKE :term)',
                { term }
            );
        }

        if (dto.startDate && dto.endDate) {
            qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate)
            });
        }

        qb.orderBy('payment.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        const [items, total] = await qb.getManyAndCount();

        // Calculate summary metrics only on page 1 or when explicitly requested
        let metrics: any = null;
        if (page === 1 && dto.includeMetrics !== 'false') {
            const metricsRes = await this.getPaymentMetrics();
            metrics = metricsRes.data;
        }

        return ResponseUtils.successResponseHandler(200, 'Payments retrieved successfully', 'data', {
            data: items,
            total,
            pageCount: Math.ceil(total / limit),
            page,
            limit,
            metrics
        });
    }

    /**
     * Dedicated Payment Metrics Aggregation endpoint (separated from paginated queries).
     */
    async getPaymentMetrics(): Promise<ApiResponse<any>> {
        const paymentRepo = this.dataSource.getRepository(Payments);
        const metricsRaw = await paymentRepo.createQueryBuilder('p')
            .select([
                'COUNT(p.id) AS totalCount',
                "SUM(CASE WHEN p.status = 'PAID' THEN CAST(p.amount AS DECIMAL(10,2)) ELSE 0 END) AS totalCollected",
                "SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END) AS paidCount",
                "SUM(CASE WHEN p.status IN ('PENDING', 'PROCESSING') THEN 1 ELSE 0 END) AS pendingCount",
                "SUM(CASE WHEN p.status IN ('FAILED', 'CANCELLED', 'EXPIRED') THEN 1 ELSE 0 END) AS failedCount",
                'SUM(CASE WHEN p.needsAdminReview = 1 THEN 1 ELSE 0 END) AS reviewCount'
            ])
            .getRawOne();

        const metrics = {
            totalCollected: Number(metricsRaw?.totalCollected || 0),
            totalCount: Number(metricsRaw?.totalCount || 0),
            paidCount: Number(metricsRaw?.paidCount || 0),
            pendingCount: Number(metricsRaw?.pendingCount || 0),
            failedCount: Number(metricsRaw?.failedCount || 0),
            reviewCount: Number(metricsRaw?.reviewCount || 0)
        };

        return ResponseUtils.successResponseHandler(200, 'Payment metrics retrieved successfully', 'data', metrics);
    }

    /**
     * Dedicated Admin Refund Query with pagination and status filtering.
     */
    async getAllRefunds(dto: any): Promise<ApiResponse<any>> {
        const page = Math.max(1, Number(dto.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(dto.limit) || 15));
        const skip = (page - 1) * limit;

        const refundRepo = this.dataSource.getRepository(PaymentRefunds);
        const qb = refundRepo.createQueryBuilder('refund')
            .leftJoinAndSelect('refund.payment', 'payment')
            .leftJoinAndSelect('payment.order', 'order')
            .leftJoinAndSelect('order.user', 'user');

        if (dto.status && dto.status !== 'ALL') {
            qb.andWhere('refund.status = :status', { status: dto.status });
        }

        if (dto.search && dto.search.trim()) {
            const term = `%${dto.search.trim()}%`;
            qb.andWhere(
                '(refund.refundId LIKE :term OR payment.tranId LIKE :term OR payment.bankTranId LIKE :term OR order.orderId LIKE :term)',
                { term }
            );
        }

        qb.orderBy('refund.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        const [items, total] = await qb.getManyAndCount();

        // Calculate summary metrics only on page 1 or when explicitly requested
        let metrics: any = null;
        if (page === 1 && dto.includeMetrics !== 'false') {
            const metricsRes = await this.getRefundMetrics();
            metrics = metricsRes.data;
        }

        return ResponseUtils.successResponseHandler(200, 'Refunds retrieved successfully', 'data', {
            data: items,
            total,
            pageCount: Math.ceil(total / limit),
            page,
            limit,
            metrics
        });
    }

    /**
     * Dedicated Refund Metrics Aggregation endpoint (separated from paginated queries).
     */
    async getRefundMetrics(): Promise<ApiResponse<any>> {
        const refundRepo = this.dataSource.getRepository(PaymentRefunds);
        const metricsRaw = await refundRepo.createQueryBuilder('r')
            .select([
                'COUNT(r.id) AS totalCount',
                "SUM(CASE WHEN r.status = 'PENDING' THEN 1 ELSE 0 END) AS pendingCount",
                "SUM(CASE WHEN r.status = 'SUCCEEDED' THEN 1 ELSE 0 END) AS succeededCount",
                "SUM(CASE WHEN r.status = 'SUCCEEDED' THEN CAST(r.amount AS DECIMAL(10,2)) ELSE 0 END) AS totalRefundedAmount"
            ])
            .getRawOne();

        const metrics = {
            totalCount: Number(metricsRaw?.totalCount || 0),
            pendingCount: Number(metricsRaw?.pendingCount || 0),
            succeededCount: Number(metricsRaw?.succeededCount || 0),
            totalRefundedAmount: Number(metricsRaw?.totalRefundedAmount || 0)
        };

        return ResponseUtils.successResponseHandler(200, 'Refund metrics retrieved successfully', 'data', metrics);
    }

    /**
     * Admin initiates an online or offline refund for a PAID payment attempt.
     * Enforces strict financial invariant: Sum(Refunds) + new amount <= payment.amount.
     * Enforces active refund barrier and idempotency.
     */
    async initiateAdminRefund(
        paymentId: string,
        amount: number,
        reason: string,
        adminUserId: string,
        idempotencyKey?: string
    ): Promise<{ success: boolean; message: string; refund?: PaymentRefunds }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Pessimistic Row Lock on parent Payment
            const lockedPayment = await queryRunner.manager.findOne(Payments, {
                where: [{ id: paymentId }, { tranId: paymentId }],
                relations: ['order'],
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedPayment) {
                throw new NotFoundException(`Payment record not found: ${paymentId}`);
            }

            // 2. Enforce financial invariant: Payment MUST be PAID
            if (lockedPayment.status !== PaymentAttemptStatus.PAID) {
                throw new BadRequestException(
                    `Cannot refund payment in "${lockedPayment.status}" state. Only PAID payments are refundable.`
                );
            }

            // 3. Query all existing refunds on this payment attempt
            const existingRefunds = await queryRunner.manager.find(PaymentRefunds, {
                where: { paymentId: lockedPayment.id }
            });

            const deterministicKey = idempotencyKey || `ref_${lockedPayment.id}_${Date.now()}`;

            // Idempotency check: return existing record if key matches
            const existingByKey = existingRefunds.find((r) => r.idempotencyKey === deterministicKey);
            if (existingByKey) {
                await queryRunner.rollbackTransaction();
                return {
                    success: true,
                    message: 'Refund request already recorded (idempotent)',
                    refund: existingByKey
                };
            }

            // 4. Strict Barrier: Reject if another refund is already in-flight
            const inFlightRefund = existingRefunds.find(
                (r) =>
                    r.status === RefundStatus.PENDING ||
                    r.status === RefundStatus.PROCESSING ||
                    r.status === RefundStatus.UNKNOWN
            );
            if (inFlightRefund) {
                throw new BadRequestException(
                    `Cannot initiate refund: Another refund (${inFlightRefund.refundId}) is currently in ${inFlightRefund.status} state. Please wait for it to settle.`
                );
            }

            // 5. Enforce mathematical invariant: Sum(SUCCEEDED) + new amount <= payment.amount
            const totalAlreadyRefunded = existingRefunds
                .filter((r) => r.status === RefundStatus.SUCCEEDED)
                .reduce((sum, r) => sum + Number(r.amount || 0), 0);

            const remainingRefundable = Math.max(0, Number(lockedPayment.amount || 0) - totalAlreadyRefunded);
            const requestedRefundAmount = Number(amount);

            if (isNaN(requestedRefundAmount) || requestedRefundAmount <= 0) {
                throw new BadRequestException('Refund amount must be a positive number.');
            }

            if (requestedRefundAmount > remainingRefundable) {
                throw new BadRequestException(
                    `Requested refund amount (${requestedRefundAmount.toFixed(2)}) exceeds remaining refundable balance (${remainingRefundable.toFixed(2)}).`
                );
            }

            const refundIndex = existingRefunds.length + 1;
            const refundId = `REF-${lockedPayment.order?.orderId || lockedPayment.tranId}-R${refundIndex}-${Date.now().toString().slice(-4)}`;

            // 6. Create refund record in PENDING status
            const refund = queryRunner.manager.create(PaymentRefunds, {
                paymentId: lockedPayment.id,
                refundId,
                amount: requestedRefundAmount.toFixed(2),
                status: RefundStatus.PENDING,
                reason,
                initiatedBy: 'ADMIN',
                initiatedByUserId: adminUserId,
                idempotencyKey: deterministicKey
            });
            await queryRunner.manager.save(refund);

            // 7. Insert immutable audit log
            const auditLog = queryRunner.manager.create(PaymentAuditLogs, {
                paymentId: lockedPayment.id,
                refundId,
                action: 'ADMIN_INITIATE_REFUND',
                actorId: adminUserId,
                actorRole: 'admin',
                previousState: null,
                newState: RefundStatus.PENDING,
                reason,
                metadata: {
                    requestedAmount: requestedRefundAmount,
                    remainingRefundable,
                    paymentTranId: lockedPayment.tranId
                }
            });
            await queryRunner.manager.save(auditLog);

            await queryRunner.commitTransaction();

            // 8. Gateway online refund call (Out-of-DB lock to avoid long-running DB locks)
            if (lockedPayment.gateway === PaymentGateway.SSLCOMMERZ && lockedPayment.bankTranId) {
                try {
                    const gwRes = await this.sslcommerzService.initiateRefund({
                        bankTranId: lockedPayment.bankTranId,
                        refundAmount: requestedRefundAmount.toFixed(2),
                        refundRemarks: reason,
                        refundRefId: refund.refundId
                    });

                    const gwStatus = (gwRes?.status || '').toLowerCase();
                    if (gwStatus === 'success') {
                        refund.status = RefundStatus.PROCESSING;
                        refund.gatewayRefundId = gwRes.refund_ref_id || gwRes.trans_id || null;
                    } else {
                        refund.status = RefundStatus.FAILED;
                        refund.failureReason = gwRes.errorReason || 'Gateway rejected refund request';
                    }
                } catch (gwErr: any) {
                    this.logger.error(`[Admin Refund Gateway Timeout/Error] ${gwErr?.message}`);
                    // 🛡️ CRITICAL: Do NOT mark failed on gateway timeout. Keep UNKNOWN for reconciliation!
                    refund.status = RefundStatus.UNKNOWN;
                    refund.failureReason = `Gateway network timeout: ${gwErr?.message}. Awaiting reconciliation.`;
                }

                await this.dataSource.getRepository(PaymentRefunds).save(refund);
            }

            return {
                success: true,
                message: `Refund initiated with status ${refund.status}`,
                refund
            };
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Admin action to update refund status (e.g. after manual MFS disbursement or gateway settlement).
     * Enforces ACID transaction, row lock, partial vs full refund status, and immutable audit logs.
     */
    async adminRefundAction(
        refundId: string,
        action: 'MARK_SUCCEEDED' | 'MARK_FAILED',
        reason: string,
        adminUserId: string
    ): Promise<{ success: boolean; message: string }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const refund = await queryRunner.manager.findOne(PaymentRefunds, {
                where: [{ id: refundId }, { refundId }],
                lock: { mode: 'pessimistic_write' }
            });

            if (!refund) {
                throw new NotFoundException(`Refund record not found: ${refundId}`);
            }

            if (refund.status === RefundStatus.SUCCEEDED) {
                await queryRunner.rollbackTransaction();
                return { success: true, message: 'Refund is already marked as SUCCEEDED.' };
            }

            const previousState = refund.status;

            if (action === 'MARK_SUCCEEDED') {
                const lockedPayment = await queryRunner.manager.findOne(Payments, {
                    where: { id: refund.paymentId },
                    relations: ['order'],
                    lock: { mode: 'pessimistic_write' }
                });

                if (!lockedPayment) {
                    throw new NotFoundException(`Associated payment record not found: ${refund.paymentId}`);
                }

                refund.status = RefundStatus.SUCCEEDED;
                refund.completedAt = new Date();
                refund.failureReason = null;
                await queryRunner.manager.save(refund);

                // Fetch all refunds on this payment to determine full vs partial
                const allRefunds = await queryRunner.manager.find(PaymentRefunds, {
                    where: { paymentId: lockedPayment.id }
                });

                const totalSucceededRefundAmount = allRefunds
                    .filter((r) => r.status === RefundStatus.SUCCEEDED || r.id === refund.id)
                    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

                const paidAmount = Number(lockedPayment.amount || 0);

                // Update order payment status: Full vs Partial
                const order = lockedPayment.order;
                if (order) {
                    if (totalSucceededRefundAmount >= paidAmount) {
                        order.paymentStatus = PaymentStatus.REFUNDED;
                    } else if (totalSucceededRefundAmount > 0) {
                        order.paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
                    }
                    await queryRunner.manager.save(order);
                }

                // Insert immutable audit log
                const auditLog = queryRunner.manager.create(PaymentAuditLogs, {
                    paymentId: lockedPayment.id,
                    refundId: refund.refundId,
                    action: 'ADMIN_REFUND_MARK_SUCCEEDED',
                    actorId: adminUserId,
                    actorRole: 'admin',
                    previousState,
                    newState: RefundStatus.SUCCEEDED,
                    reason,
                    metadata: {
                        refundAmount: refund.amount,
                        totalSucceededRefundAmount,
                        paymentAmount: lockedPayment.amount,
                        orderPaymentStatus: order?.paymentStatus
                    }
                });
                await queryRunner.manager.save(auditLog);

                await queryRunner.commitTransaction();
                return { success: true, message: 'Refund marked as SUCCEEDED and order payment status updated.' };
            }

            if (action === 'MARK_FAILED') {
                refund.status = RefundStatus.FAILED;
                refund.failureReason = reason || 'Admin marked refund as failed';
                await queryRunner.manager.save(refund);

                const auditLog = queryRunner.manager.create(PaymentAuditLogs, {
                    paymentId: refund.paymentId,
                    refundId: refund.refundId,
                    action: 'ADMIN_REFUND_MARK_FAILED',
                    actorId: adminUserId,
                    actorRole: 'admin',
                    previousState,
                    newState: RefundStatus.FAILED,
                    reason,
                    metadata: {
                        refundAmount: refund.amount
                    }
                });
                await queryRunner.manager.save(auditLog);

                await queryRunner.commitTransaction();
                return { success: true, message: 'Refund marked as FAILED.' };
            }

            throw new BadRequestException(`Invalid refund action: ${action}`);
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Admin Review Actions for flagged transactions (APPROVE, REJECT, HOLD).
     * Strictly verifies gateway status before approval and logs immutable audit trails.
     */
    async adminReviewAction(
        paymentId: string,
        action: 'APPROVE' | 'REJECT' | 'HOLD',
        reason: string,
        adminUserId: string
    ): Promise<{ success: boolean; message: string }> {
        const paymentRepo = this.dataSource.getRepository(Payments);

        const payment = await paymentRepo.findOne({
            where: { id: paymentId },
            relations: ['order']
        });

        if (!payment) {
            throw new NotFoundException(`Payment attempt not found: ${paymentId}`);
        }

        const previousState = payment.status;

        if (action === 'HOLD') {
            payment.needsAdminReview = true;
            payment.adminReviewReason = `ON_HOLD_BY_ADMIN: ${reason}`;
            await paymentRepo.save(payment);

            // Audit Log
            const auditRepo = this.dataSource.getRepository(PaymentAuditLogs);
            const auditLog = auditRepo.create({
                paymentId: payment.id,
                action: 'ADMIN_PAYMENT_HOLD',
                actorId: adminUserId,
                actorRole: 'admin',
                previousState,
                newState: payment.status,
                reason,
                metadata: { tranId: payment.tranId, orderId: payment.order?.orderId }
            });
            await auditRepo.save(auditLog);

            return { success: true, message: 'Payment kept on hold for further investigation.' };
        }

        if (action === 'APPROVE') {
            // Re-verify that funds are genuinely VALID on gateway
            const queryRes = await this.sslcommerzService.queryTransaction(payment.tranId);
            const element = queryRes?.element?.[0];

            if (!element || (element.status !== 'VALID' && element.status !== 'VALIDATED')) {
                throw new BadRequestException(
                    `Cannot approve payment! Gateway reports status: "${element?.status || 'UNKNOWN'}". Funds are not confirmed by SSLCommerz.`
                );
            }

            // Confirm payment safely
            await this.paymentConfirmationService.confirmPayment(
                element.val_id || payment.valId || '',
                payment.tranId,
                PaymentEventSource.ADMIN,
                { ...element, approvedByAdminUserId: adminUserId, approvalReason: reason }
            );

            // Audit Log
            const auditRepo = this.dataSource.getRepository(PaymentAuditLogs);
            const auditLog = auditRepo.create({
                paymentId: payment.id,
                action: 'ADMIN_PAYMENT_APPROVE',
                actorId: adminUserId,
                actorRole: 'admin',
                previousState,
                newState: PaymentAttemptStatus.PAID,
                reason,
                metadata: { tranId: payment.tranId, valId: element.val_id }
            });
            await auditRepo.save(auditLog);

            return { success: true, message: 'Payment verified with gateway and marked as PAID.' };
        }

        if (action === 'REJECT') {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                const lockedPayment = await queryRunner.manager.findOne(Payments, {
                    where: { id: paymentId },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!lockedPayment) throw new NotFoundException('Payment not found');

                lockedPayment.status = PaymentAttemptStatus.FAILED;
                lockedPayment.failureCode = 'ADMIN_REJECTED';
                lockedPayment.failureReason = reason;
                lockedPayment.needsAdminReview = false;
                await queryRunner.manager.save(lockedPayment);

                const lockedOrder = await queryRunner.manager.findOne(Orders, {
                    where: { id: lockedPayment.orderId },
                    relations: ['orderSummaries'],
                    lock: { mode: 'pessimistic_write' }
                });

                if (lockedOrder && lockedOrder.status !== OrderStatus.CANCELLED) {
                    // Restock inventory atomically
                    const summaries = lockedOrder.orderSummaries || [];
                    for (const item of summaries) {
                        if (!item.productId) continue;
                        const product = await queryRunner.manager.findOne(Product, {
                            where: { id: item.productId },
                            lock: { mode: 'pessimistic_write' }
                        });
                        if (product) {
                            const curQty = Number(product.quantity) || 0;
                            const restockQty = Number(item.quantity) || 1;
                            let updatedSizeStock = product.sizeStock;
                            const size = item.selectedSize || (item as any).size || '';
                            if (updatedSizeStock && typeof updatedSizeStock === 'object' && size && updatedSizeStock[size] !== undefined) {
                                const curSizeQty = Number(updatedSizeStock[size]) || 0;
                                updatedSizeStock = {
                                    ...updatedSizeStock,
                                    [size]: curSizeQty + restockQty
                                };
                            }
                            await queryRunner.manager.update(Product, product.id, {
                                quantity: curQty + restockQty,
                                sizeStock: updatedSizeStock
                            });
                        }
                    }

                    lockedOrder.status = OrderStatus.CANCELLED;
                    lockedOrder.paymentStatus = PaymentStatus.FAILED;
                    await queryRunner.manager.save(lockedOrder);
                }

                // Audit Log
                const auditLog = queryRunner.manager.create(PaymentAuditLogs, {
                    paymentId: lockedPayment.id,
                    action: 'ADMIN_PAYMENT_REJECT',
                    actorId: adminUserId,
                    actorRole: 'admin',
                    previousState,
                    newState: PaymentAttemptStatus.FAILED,
                    reason,
                    metadata: { tranId: lockedPayment.tranId }
                });
                await queryRunner.manager.save(auditLog);

                await queryRunner.commitTransaction();
                return { success: true, message: 'Payment attempt rejected, order cancelled, and inventory restored.' };
            } catch (err: any) {
                await queryRunner.rollbackTransaction();
                throw err;
            } finally {
                await queryRunner.release();
            }
        }

        throw new BadRequestException(`Invalid action: ${action}`);
    }

    /**
     * Retrieves paginated payment audit logs with optional paymentId, refundId, action, or search filters.
     */
    async getAuditLogs(params: {
        paymentId?: string;
        refundId?: string;
        action?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
        const skip = (page - 1) * limit;

        const qb = this.dataSource.getRepository(PaymentAuditLogs).createQueryBuilder('log');
        if (params.paymentId) {
            qb.andWhere('log.paymentId = :paymentId', { paymentId: params.paymentId });
        }
        if (params.refundId) {
            qb.andWhere('log.refundId = :refundId', { refundId: params.refundId });
        }
        if (params.action && params.action !== 'ALL') {
            qb.andWhere('log.action = :action', { action: params.action });
        }
        if (params.search && params.search.trim()) {
            const term = `%${params.search.trim()}%`;
            qb.andWhere(
                '(log.actorId LIKE :term OR log.paymentId LIKE :term OR log.refundId LIKE :term OR log.reason LIKE :term)',
                { term }
            );
        }

        qb.orderBy('log.createdAt', 'DESC').skip(skip).take(limit);

        const [items, total] = await qb.getManyAndCount();
        return ResponseUtils.successResponseHandler(200, 'Audit logs retrieved successfully', 'data', {
            data: items,
            total,
            page,
            limit,
            pageCount: Math.ceil(total / limit)
        });
    }

    /**
     * Sanitizes gateway metadata before recording to PaymentAuditLogs.
     * Delegates to GatewaySanitizer with active-path cycle protection and Luhn validation.
     */
    private sanitizeGatewayMetadata(raw: any): Record<string, any> {
        return GatewaySanitizer.sanitizeDefensive(raw) || {};
    }

    /**
     * Admin Verified Gateway-First Reconciliation (No Direct / Blind Force-Paid).
     * 1. Performs zero-DB-lock gateway query (Stripe / SSLCommerz).
     * 2. Authoritatively verifies minor unit amount & currency.
     * 3. Confirms payment in a short-lived (< 5ms) DB transaction with row locks.
     * 4. Sanitizes sensitive gateway data before recording in PaymentAuditLogs.
     */
    async adminVerifiedReconciliation(
        paymentId: string,
        adminUser?: any
    ): Promise<{ success: boolean; message: string; payment?: any; discrepancy?: string }> {
        const paymentRepo = this.dataSource.getRepository(Payments);
        const orderRepo = this.dataSource.getRepository(Orders);

        const payment = await paymentRepo.findOne({
            where: [{ id: paymentId }, { tranId: paymentId }],
            relations: ['order']
        });

        if (!payment) {
            throw new NotFoundException(`Payment record not found: ${paymentId}`);
        }

        const adminUserId = adminUser?.id || adminUser?.userId || 'admin-system';
        const adminRole = adminUser?.role || 'admin';

        // Idempotency: If already marked as PAID, exit cleanly
        if (payment.status === PaymentAttemptStatus.PAID) {
            return {
                success: true,
                message: 'Payment is already marked as PAID.',
                payment
            };
        }

        const order = payment.order || (payment.orderId ? await orderRepo.findOne({ where: { id: payment.orderId } }) : null);
        if (!order) {
            throw new NotFoundException(`Associated order not found for payment ${paymentId}`);
        }

        // 1. Gateway-Specific Verification (ZERO DB LOCK)
        let isGatewayPaid = false;
        let gatewayRawResponse: any = null;
        let gatewayAmountMinor: bigint | null = null;
        let gatewayCurrency: string = '';

        if (payment.gateway === PaymentGateway.STRIPE) {
            if (!payment.tranId || !payment.tranId.startsWith('pi_')) {
                throw new BadRequestException(`Invalid Stripe PaymentIntent ID for tranId: "${payment.tranId}"`);
            }

            try {
                const intent = await this.stripe.paymentIntents.retrieve(payment.tranId);
                gatewayRawResponse = intent;

                if (intent.status === 'succeeded') {
                    isGatewayPaid = true;
                    gatewayAmountMinor = BigInt(intent.amount);
                    gatewayCurrency = (intent.currency || 'USD').toUpperCase();
                } else if (intent.status === 'canceled') {
                    payment.status = PaymentAttemptStatus.CANCELLED;
                    payment.failureReason = 'Payment canceled on Stripe.';
                    payment.needsAdminReview = false;
                    await paymentRepo.save(payment);

                    const auditRepo = this.dataSource.getRepository(PaymentAuditLogs);
                    const auditLog = auditRepo.create({
                        paymentId: payment.id,
                        action: 'ADMIN_RECONCILIATION_CANCELED',
                        actorId: adminUserId,
                        actorRole: adminRole,
                        previousState: payment.status,
                        newState: PaymentAttemptStatus.CANCELLED,
                        reason: 'Gateway confirmed payment is canceled',
                        metadata: GatewaySanitizer.extractStripeAuditMetadata(intent)
                    });
                    await auditRepo.save(auditLog);

                    return {
                        success: false,
                        message: 'Stripe confirmed payment is canceled.',
                        payment
                    };
                } else {
                    return {
                        success: false,
                        message: `Stripe PaymentIntent is in "${intent.status}" state. Funds are not settled.`,
                        payment,
                        discrepancy: `Gateway Status: ${intent.status}`
                    };
                }
            } catch (err: any) {
                this.logger.error(`[Admin Reconcile] Stripe query failed for ${payment.tranId}: ${err?.message}`);
                throw new BadRequestException(`Failed to query Stripe gateway: ${err?.message}`);
            }
        } else if (payment.gateway === PaymentGateway.SSLCOMMERZ) {
            try {
                const queryRes = await this.sslcommerzService.queryTransaction(payment.tranId);
                gatewayRawResponse = queryRes;
                const element = queryRes?.element?.[0];

                if (element && (element.status === 'VALID' || element.status === 'VALIDATED') && element.val_id) {
                    isGatewayPaid = true;
                    const parsedGwAmount = CurrencyUtils.toMinorUnitsBigInt(String(element.amount || 0), (element.currency || 'BDT').toUpperCase());
                    gatewayAmountMinor = parsedGwAmount;
                    gatewayCurrency = (element.currency || 'BDT').toUpperCase();
                } else {
                    return {
                        success: false,
                        message: `SSLCommerz reports transaction status: "${element?.status || 'UNKNOWN'}". Funds are not confirmed.`,
                        payment,
                        discrepancy: `Gateway Status: ${element?.status || 'UNKNOWN'}`
                    };
                }
            } catch (err: any) {
                this.logger.error(`[Admin Reconcile] SSLCommerz query failed for ${payment.tranId}: ${err?.message}`);
                throw new BadRequestException(`Failed to query SSLCommerz gateway: ${err?.message}`);
            }
        } else {
            throw new BadRequestException(`Reconciliation not supported for gateway "${payment.gateway}"`);
        }

        if (!isGatewayPaid || gatewayAmountMinor === null) {
            return {
                success: false,
                message: 'Payment not confirmed by gateway.',
                payment
            };
        }

        // 2. Strict Amount & Currency Invariant Validation
        const expectedCurrency = (order.currency || payment.currency || 'USD').toUpperCase();
        const expectedMinor = CurrencyUtils.toMinorUnitsBigInt(String(order.totalAmount), expectedCurrency);

        if (expectedCurrency !== gatewayCurrency) {
            payment.needsAdminReview = true;
            payment.adminReviewReason = `CURRENCY_MISMATCH: Expected ${expectedCurrency}, Gateway reported ${gatewayCurrency}`;
            await paymentRepo.save(payment);

            return {
                success: false,
                message: `Currency mismatch! Expected ${expectedCurrency}, got ${gatewayCurrency}`,
                payment,
                discrepancy: 'CURRENCY_MISMATCH'
            };
        }

        if (expectedMinor !== gatewayAmountMinor) {
            payment.needsAdminReview = true;
            payment.adminReviewReason = `AMOUNT_MISMATCH: Expected minor units ${expectedMinor}, Gateway reported ${gatewayAmountMinor}`;
            await paymentRepo.save(payment);

            return {
                success: false,
                message: `Amount mismatch! Order requires ${expectedMinor} minor units, but gateway settled ${gatewayAmountMinor}`,
                payment,
                discrepancy: 'AMOUNT_MISMATCH'
            };
        }

        // 3. Short-Lived Database Transaction (< 5ms)
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const lockedOrder = await queryRunner.manager.findOne(Orders, {
                where: { id: order.id },
                lock: { mode: 'pessimistic_write' }
            });

            const lockedPayment = await queryRunner.manager.findOne(Payments, {
                where: { id: payment.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedOrder || !lockedPayment) {
                await queryRunner.rollbackTransaction();
                throw new NotFoundException('Order or payment record disappeared during reconciliation.');
            }

            if (lockedPayment.status === PaymentAttemptStatus.PAID) {
                await queryRunner.rollbackTransaction();
                return { success: true, message: 'Payment was already reconciled by concurrent worker.', payment: lockedPayment };
            }

            lockedPayment.status = PaymentAttemptStatus.PAID;
            lockedPayment.paidAt = new Date();
            lockedPayment.needsAdminReview = false;
            lockedPayment.adminReviewReason = null;
            await queryRunner.manager.save(lockedPayment);

            lockedOrder.status = OrderStatus.ORDER_PLACED;
            lockedOrder.paymentStatus = PaymentStatus.PAID;
            lockedOrder.statusHistory = [
                ...(lockedOrder.statusHistory || []),
                {
                    status: OrderStatus.ORDER_PLACED,
                    timestamp: new Date().toISOString(),
                    updatedBy: adminUserId,
                    note: `Payment verified and reconciled by admin via ${payment.gateway}`
                }
            ];
            await queryRunner.manager.save(lockedOrder);

            // Enqueue Transactional Outbox Event
            await PaymentOutboxService.enqueueEvent(
                queryRunner,
                'PAYMENT',
                lockedPayment.id,
                'PAYMENT_CONFIRMED',
                {
                    paymentId: lockedPayment.id,
                    orderId: lockedOrder.orderId,
                    tranId: lockedPayment.tranId,
                    amount: lockedPayment.amount,
                    currency: lockedPayment.currency,
                    reconciledBy: adminUserId
                }
            );

            // Audit Log with Gateway-Specific Allowlisted Metadata
            const safeGatewayMetadata = payment.gateway === PaymentGateway.STRIPE
                ? GatewaySanitizer.extractStripeAuditMetadata(gatewayRawResponse)
                : GatewaySanitizer.extractSslcommerzAuditMetadata(gatewayRawResponse);

            const auditLog = queryRunner.manager.create(PaymentAuditLogs, {
                paymentId: lockedPayment.id,
                action: 'ADMIN_VERIFIED_RECONCILIATION',
                actorId: adminUserId,
                actorRole: adminRole,
                previousState: payment.status,
                newState: PaymentAttemptStatus.PAID,
                reason: `Verified reconciliation by admin via ${payment.gateway}`,
                metadata: {
                    tranId: lockedPayment.tranId,
                    gateway: payment.gateway,
                    gatewayMetadata: safeGatewayMetadata
                }
            });
            await queryRunner.manager.save(auditLog);

            await queryRunner.commitTransaction();
            this.logger.log(`[Admin Reconcile] Successfully reconciled payment ${payment.id} for order ${order.orderId}`);

            return {
                success: true,
                message: `Payment successfully reconciled and confirmed via ${payment.gateway}.`,
                payment: lockedPayment
            };
        } catch (txErr: any) {
            await queryRunner.rollbackTransaction();
            throw txErr;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Retrieves paginated list of failed/dead-letter outbox events.
     */
    async getOutboxDeadLetterEvents(query: any) {
        const page = Math.max(1, Number(query?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
        const skip = (page - 1) * limit;

        const outboxRepo = this.dataSource.getRepository(PaymentOutboxEvents);
        const qb = outboxRepo.createQueryBuilder('event')
            .where('event.status = :status OR event.retryCount >= 5', { status: OutboxStatus.FAILED });

        if (query?.eventType && query.eventType !== 'ALL') {
            qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
        }

        qb.orderBy('event.updatedAt', 'DESC')
          .skip(skip)
          .take(limit);

        const [events, total] = await qb.getManyAndCount();
        return ResponseUtils.successResponseHandler(200, 'Dead-letter outbox events retrieved successfully', 'data', {
            data: events,
            total,
            page,
            limit,
            pageCount: Math.ceil(total / limit)
        });
    }

    /**
     * Admin Replays a Dead-Letter Outbox Event.
     * Enforces atomic conditional update (WHERE status = 'FAILED'), audit logging, and lease reset.
     */
    async replayOutboxEvent(
        eventId: string,
        adminUser?: any
    ): Promise<{ success: boolean; message: string; eventId: string }> {
        const outboxRepo = this.dataSource.getRepository(PaymentOutboxEvents);
        const event = await outboxRepo.findOne({ where: { id: eventId } });

        if (!event) {
            throw new NotFoundException(`Outbox event not found: ${eventId}`);
        }

        const adminUserId = adminUser?.id || adminUser?.userId || 'admin-system';
        const adminRole = adminUser?.role || 'admin';

        // Atomic Conditional Guard: UPDATE ... WHERE id = :id AND (status = 'FAILED' OR retryCount >= 5)
        const result = await outboxRepo.createQueryBuilder()
            .update(PaymentOutboxEvents)
            .set({
                status: OutboxStatus.PENDING,
                retryCount: 0,
                replayCount: () => 'replayCount + 1',
                nextAttemptAt: new Date(),
                leaseToken: null,
                leaseExpiresAt: null
            })
            .where('id = :id AND (status = :failedStatus OR retryCount >= 5)', {
                id: eventId,
                failedStatus: OutboxStatus.FAILED
            })
            .execute();

        if (result.affected === 0) {
            throw new BadRequestException('Event cannot be replayed. It is either not in FAILED state or currently locked by another worker.');
        }

        // Immutable Replay Audit Log
        const auditRepo = this.dataSource.getRepository(PaymentAuditLogs);
        const auditLog = auditRepo.create({
            paymentId: null,
            action: 'REPLAY_OUTBOX_EVENT',
            actorId: adminUserId,
            actorRole: adminRole,
            previousState: event.status,
            newState: OutboxStatus.PENDING,
            reason: `Admin requested dead-letter outbox event replay (Replay #${event.replayCount + 1})`,
            metadata: {
                eventId: event.id,
                eventType: event.eventType,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                previousError: event.failureReason,
                replayCount: event.replayCount + 1,
                timestamp: new Date().toISOString()
            }
        });
        await auditRepo.save(auditLog);

        this.logger.log(`[Outbox Replay] Event ${eventId} successfully re-queued by admin ${adminUserId}`);
        return {
            success: true,
            message: `Outbox event ${eventId} successfully re-queued for delivery.`,
            eventId
        };
    }
}
