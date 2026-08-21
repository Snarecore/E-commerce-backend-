import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderStatus, PaymentStatus } from 'src/enums/order-status.enum';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { Orders } from '../order/entity/order.entity';

@Injectable()
export class PaymentsService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Orders)
        private readonly orderRepository: Repository<Orders>
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
        products: Array<{ price: number; quantity: number }>;
        currency?: string;
    }): Promise<{ clientSecret: string }> {
        let amount = 0;
        if (body?.products && body.products.length > 0) {
            body.products.forEach((product) => {
                amount += (Number(product.price) || 0) * (product.quantity || 1);
            });
        }
        if (amount <= 0) {
            amount = 1;
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: (body.currency || 'usd').toLowerCase(),
            payment_method_types: ['card'],
        });

        return { clientSecret: paymentIntent.client_secret ?? '' };
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
            case 'checkout.session.completed': {
                const session = event.data.object;
                await this.handleCheckoutSessionCompleted(session);
                break;
            }
            case 'checkout.session.expired': {
                const session = event.data.object;
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
}
