import { ProductPricingResolver } from "../../utils/pricing.engine";
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseUtils, ApiResponse } from '../../utils/response.utils';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { Between, DataSource, FindOptionsOrder, In, LessThanOrEqual, MoreThanOrEqual, Like } from 'typeorm';
import { OrdersRepository } from './order.repository';
import { CreateOrdersDto } from './dto/create-order.dto';
import { OrdersInterface } from './type/order.type';
import { Orders } from './entity/order.entity';
import { OrdersFilterDto } from './dto/order-filter.dto';
import { OrdersFilter } from './type/order-filter.type';
import { UpdateOrdersDto } from './dto/update.order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { UniqueCodeGeneratorService } from '../unique-code-generator/unique-code-generator.service';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { CostSource } from '../../enums/profit-report.enum';
import { toSafeUser } from '../../utils/safe-user.utils';
import { ProductRepository } from '../inventory/product/product.repository';
import { Product } from '../inventory/product/entities/product.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { unitAfterDiscount } from '../../utils/helper.utils';
import { NotificationService } from '../notification/notification.service';
import { CouponService } from '../coupon/coupon.service';
import { MegaDiscountRepository, SINGLETON_MEGA_DISCOUNT_ID } from '../setting/mega-discount/mega-discount.repository';
import { MegaDiscount } from '../setting/mega-discount/entities/mega-discount.entity';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/constants/audit-action.enum';
import { AuditModule } from '../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../audit-log/constants/audit-target-type.enum';


const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
    [OrderStatus.PENDING]: [OrderStatus.ORDER_PLACED, OrderStatus.PROCESSING, OrderStatus.REJECTED, OrderStatus.CANCELLED],
    [OrderStatus.ORDER_PLACED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
    [OrderStatus.COMPLETED]: [OrderStatus.RETURNED],
    [OrderStatus.REJECTED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.RETURNED]: [],
    [OrderStatus.FAILED]: [],
};

const DEDUCTED_STATUS_GROUP = new Set([
    OrderStatus.PENDING,
    OrderStatus.ORDER_PLACED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED
]);

const RESTOCKED_STATUS_GROUP = new Set([
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
    OrderStatus.RETURNED,
    OrderStatus.FAILED
]);

import { SocketService } from '../socket/socket.service';
import { SocketEvent, SOCKET_ROOMS } from '../socket/socket.constants';
import { BlacklistService } from '../risk/services/blacklist.service';
import {
    BlacklistEntity,
    BlacklistStatusEnum,
    BlacklistSubjectTypeEnum,
    BlacklistSeverityEnum
} from '../risk/entity/blacklist.entity';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);
    private stripe: Stripe;

    constructor(
        private readonly dataSource: DataSource,
        private readonly uniqueCodeGeneratorService: UniqueCodeGeneratorService,
        private readonly repository: OrdersRepository,
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly productRepository: ProductRepository,
        @Optional() private readonly notificationService?: NotificationService,
        @Optional() private readonly configService?: ConfigService,
        @Optional() private readonly couponService?: CouponService,
        @Optional() private readonly megaDiscountRepository?: MegaDiscountRepository,
        @Optional() private readonly auditLogService?: AuditLogService,
        @Optional() private readonly socketService?: SocketService,
        @Optional() private readonly blacklistService?: BlacklistService
    ) {}

    private getStripeClient(): Stripe {
        if (!this.stripe) {
            const secretKey =
                (this.configService && this.configService.get<string>('STRIPE_SECRET_KEY')) ||
                (this.configService && this.configService.get<string>('API_SECRET_KEY')) ||
                process.env.STRIPE_SECRET_KEY ||
                process.env.API_SECRET_KEY ||
                'sk_test_51RnvzXBVnYSmQrwayblYCOqkpe6g1MYxnQ92LAMTn49Vr7xmmtqCxEZ9ks40UZBuks50zga66Zc36zV8zLy7DoGV00uRlztVlk';

            this.stripe = new Stripe(secretKey);
        }
        return this.stripe;
    }

    /**
     * Authoritative backend calculation for Cart & Checkout order preview.
     * Database Single Source of Truth (SSOT) for unit prices, delivery fee, discounts, and total.
     */
    async calculateOrderPreview(dto: {
        items?: Array<{ productId?: string; id?: string; product?: string; quantity: number; size?: string }>;
        products?: Array<{ productId?: string; id?: string; product?: string; quantity: number; size?: string }>;
        shippingAddress?: { city?: string };
        city?: string;
        couponCode?: string;
        userId?: string;
    }): Promise<ApiResponse<any>> {
        try {
            const rawItems = (dto.items && dto.items.length > 0) ? dto.items : (dto.products || []);
            if (!rawItems || rawItems.length === 0) {
                return ResponseUtils.successResponseHandler(200, 'Order preview calculated.', 'data', {
                    subtotal: 0,
                    deliveryCharge: 0,
                    deliveryZone: 'inside_dhaka',
                    discountAmount: 0,
                    couponCode: null,
                    totalAmount: 0,
                    items: []
                });
            }

            const productIds = rawItems
                .map((i: any) => i.productId || i.id || i.product)
                .filter(Boolean);

            let productMap = new Map<string, Product>();
            if (productIds.length > 0) {
                const fetchedProducts = await this.productRepository.findAll({
                    id: In(productIds)
                } as any);
                productMap = new Map<string, Product>(fetchedProducts.map(p => [p.id, p]));
            }

            let megaDiscountRecord: MegaDiscount | null = null;
            try {
                megaDiscountRecord = await this.dataSource.getRepository(MegaDiscount).findOne({
                    where: { id: SINGLETON_MEGA_DISCOUNT_ID }
                });
            } catch {
                megaDiscountRecord = null;
            }

            let subtotal = 0;
            const calculatedItems: any[] = [];

            for (const itemDto of rawItems) {
                const productId = itemDto.productId || itemDto.id || itemDto.product;
                const qty = Math.max(1, Number(itemDto.quantity) || 1);
                const product = productId ? productMap.get(productId) : null;

                const basePrice = product ? Number(product.price) || 0 : 0;
                const discountType = product?.discountType;
                const discountAmount = product ? Number(product.discountAmount) || 0 : 0;

                const unitPrice = product ? ProductPricingResolver.resolveUnitPrice({
                    price: basePrice,
                    discountType,
                    discountAmount
                }, megaDiscountRecord) : 0;

                const itemSubtotal = unitPrice * qty;
                subtotal += itemSubtotal;

                calculatedItems.push({
                    productId: product?.id || productId,
                    productName: product?.name || 'Product',
                    productImage: product?.featuredImage || '',
                    basePrice,
                    unitPrice,
                    quantity: qty,
                    itemSubtotal: Math.round((itemSubtotal + Number.EPSILON) * 100) / 100,
                    size: (itemDto as any).size || (itemDto as any).selectedSize || undefined
                });
            }

            const cityStr = (dto.shippingAddress?.city || dto.city || '').trim().toLowerCase();
            const isDhaka = cityStr.includes('dhaka');
            const deliveryCharge = calculatedItems.length > 0 ? (isDhaka ? 60 : 120) : 0;

            let discountAmount = 0;
            let validatedCouponCode: string | null = null;

            if (dto.couponCode && this.couponService) {
                try {
                    const validateRes = await this.couponService.calculateCouponPreview({
                        code: dto.couponCode.trim().toUpperCase(),
                        items: rawItems.map(i => ({ productId: String(i.productId || i.id || i.product || ''), quantity: Number(i.quantity) || 1 })),
                        deliveryZone: isDhaka ? 'dhaka' : 'outside_dhaka'
                    }, dto.userId);
                    const data = validateRes?.data || validateRes;
                    if (data?.valid || data?.discountAmount !== undefined) {
                        discountAmount = Number(data.discountAmount) || 0;
                        validatedCouponCode = data.couponCode || dto.couponCode;
                    }
                } catch {
                    discountAmount = 0;
                }
            }

            const subtotalRounded = Math.round((subtotal + Number.EPSILON) * 100) / 100;
            const totalAmount = Math.max(0, Math.round((subtotalRounded + deliveryCharge - discountAmount + Number.EPSILON) * 100) / 100);

            const result = {
                subtotal: subtotalRounded,
                deliveryCharge,
                deliveryZone: isDhaka ? 'inside_dhaka' : 'outside_dhaka',
                discountAmount,
                couponCode: validatedCouponCode,
                totalAmount,
                items: calculatedItems
            };

            return ResponseUtils.successResponseHandler(200, 'Order preview calculated successfully.', 'data', result);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate order preview.',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Builds deterministic SHA-256 fingerprint of customer checkout intent
     * (items, variants/sizes, quantities, coupon, and delivery destination).
     */
    private buildCustomerIntentFingerprint(dto: CreateOrdersDto, userId: string): string {
        const sortedItems = [...(dto.items || [])]
            .map((it) => ({
                productId: String(it.productId || (it as any).id || ''),
                quantity: Number(it.quantity || 1),
                size: String((it as any).size || (it as any).selectedSize || '')
            }))
            .sort((a, b) => a.productId.localeCompare(b.productId) || a.size.localeCompare(b.size));

        const canonicalPayload = {
            userId: String(userId || ''),
            items: sortedItems,
            couponCode: String(dto.couponCode || '').trim().toUpperCase(),
            shippingAddress: {
                address: String(dto.shippingAddress?.address || '').trim(),
                city: String(dto.shippingAddress?.city || '').trim(),
                phone: String(dto.shippingAddress?.phone || '').trim()
            }
        };

        return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
    }

    async create(dto: CreateOrdersDto, userId: string): Promise<ApiResponse<OrdersInterface>> {
        try {
            // 1. Idempotency Check with Customer Intent Fingerprint Verification
            const intentFingerprint = this.buildCustomerIntentFingerprint(dto, userId);

            if (dto.idempotencyKey) {
                const existingOrder = await this.repository.findOneByQuery({
                    idempotencyKey: dto.idempotencyKey
                });
                if (existingOrder) {
                    if (existingOrder.customerIntentFingerprint && existingOrder.customerIntentFingerprint !== intentFingerprint) {
                        throw new HttpException(
                            'Idempotency Conflict: A previous order exists with this idempotency key but with different cart items or details.',
                            HttpStatus.CONFLICT
                        );
                    }
                    return ResponseUtils.successResponseHandler(
                        201,
                        'Order already exists for this idempotency key.',
                        'data',
                        existingOrder
                    );
                }
            }

            // 2. Determine Payment Method & Payment Intent Logic
            const paymentMethodInput = (dto.paymentMethod || '').trim().toUpperCase();
            const rawPaymentIntentInput = (
                dto.paymentIntentId ||
                dto.paymentIntent ||
                dto.stripeSessionId ||
                (dto as any).sessionId ||
                ''
            ).trim();

            const isCOD =
                paymentMethodInput === 'COD' ||
                rawPaymentIntentInput.toUpperCase() === 'COD' ||
                (!paymentMethodInput && !rawPaymentIntentInput);

            const isSSLCommerz =
                paymentMethodInput === 'SSLCOMMERZ' ||
                rawPaymentIntentInput.toUpperCase() === 'SSLCOMMERZ';

            const isOrderFirstStripe =
                rawPaymentIntentInput.toUpperCase() === 'PENDING_STRIPE' ||
                rawPaymentIntentInput.toUpperCase() === 'ONLINE' ||
                (paymentMethodInput === 'ONLINE' && (!rawPaymentIntentInput || rawPaymentIntentInput.toUpperCase() === 'PENDING_STRIPE' || rawPaymentIntentInput.toUpperCase() === 'ONLINE'));

            const finalPaymentMethod = isCOD ? 'COD' : isSSLCommerz ? 'SSLCOMMERZ' : dto.paymentMethod || 'Online';
            let finalPaymentIntentId: string | null = null;
            let finalPaymentStatus: PaymentStatus = PaymentStatus.PENDING;

            if (isCOD) {
                // Completely bypass Stripe for COD
                finalPaymentIntentId = null;
                finalPaymentStatus = PaymentStatus.PENDING;
            } else if (isSSLCommerz) {
                // Completely bypass Stripe for SSLCommerz (will be paid via SSLCommerz gateway session)
                finalPaymentIntentId = null;
                finalPaymentStatus = PaymentStatus.PENDING;
            } else if (isOrderFirstStripe) {
                // Order-First flow for Stripe: pre-create order and reserve stock first; Stripe session is initiated subsequently
                finalPaymentIntentId = null;
                finalPaymentStatus = PaymentStatus.PENDING;
            } else {
                // Online Payment Verification
                if (!rawPaymentIntentInput) {
                    throw new HttpException('paymentIntentId or stripeSessionId is required for online payments.', HttpStatus.BAD_REQUEST);
                }

                // If a client secret was passed (e.g. pi_123_secret_abc), extract the base ID (pi_123)
                const cleanId = rawPaymentIntentInput.split('_secret_')[0];
                const stripeClient = this.getStripeClient();

                try {
                    if (cleanId.startsWith('cs_')) {
                        // Stripe Checkout Session
                        const session = await stripeClient.checkout.sessions.retrieve(cleanId);
                        if (session.payment_status !== 'paid') {
                            throw new HttpException('Payment not completed on Stripe checkout session.', HttpStatus.BAD_REQUEST);
                        }
                        finalPaymentIntentId = typeof session.payment_intent === 'string'
                            ? session.payment_intent
                            : session.payment_intent?.id || cleanId;
                        finalPaymentStatus = PaymentStatus.PAID;
                    } else {
                        // Stripe PaymentIntent
                        const intent = await stripeClient.paymentIntents.retrieve(cleanId);
                        if (intent.status !== 'succeeded') {
                            throw new HttpException('Payment not completed on Stripe.', HttpStatus.BAD_REQUEST);
                        }
                        finalPaymentIntentId = cleanId;
                        finalPaymentStatus = PaymentStatus.PAID;
                    }
                } catch (err: unknown) {
                    if (err instanceof HttpException) throw err;
                    const stripeErrorMsg = err instanceof Error ? err.message : String(err);
                    throw new HttpException(`Stripe payment verification failed: ${stripeErrorMsg}`, HttpStatus.BAD_REQUEST);
                }
            }

            // 3. Process Items & Cart Aggregation with Positive Integer Checks
            const rawItems = dto.items && dto.items.length > 0 ? dto.items : dto.products || [];
            if (!rawItems || rawItems.length === 0) {
                throw new HttpException('Order must contain at least one item.', HttpStatus.BAD_REQUEST);
            }

            // Aggregate requirements by Product ID and Size (eliminates lost updates and variant drifts)
            const aggregatedMap = new Map<string, { totalQty: number; sizeMap: Map<string, number> }>();
            for (const itemDto of rawItems) {
                const pid = String(itemDto.productId || itemDto.id || itemDto.product || '').trim();
                if (!pid) {
                    throw new HttpException('Product ID is missing in order item.', HttpStatus.BAD_REQUEST);
                }
                const qty = Number(itemDto.quantity);
                if (!Number.isInteger(qty) || qty <= 0) {
                    throw new HttpException(`Invalid quantity for product ${pid}. Must be an integer >= 1.`, HttpStatus.BAD_REQUEST);
                }
                const selectedSize = String((itemDto as any).size || (itemDto as any).selectedSize || (itemDto as any).sizeName || (itemDto as any).colorSize || '').trim();

                if (!aggregatedMap.has(pid)) {
                    aggregatedMap.set(pid, { totalQty: 0, sizeMap: new Map() });
                }
                const entry = aggregatedMap.get(pid)!;
                entry.totalQty += qty;
                if (selectedSize) {
                    entry.sizeMap.set(selectedSize, (entry.sizeMap.get(selectedSize) || 0) + qty);
                }
            }

            const sortedProductIds = Array.from(aggregatedMap.keys()).sort(); // 🔒 Deterministic Clustered PK Order (ASC)

            // 4. Execute Atomic Database Transaction with Controlled Deadlock / Lock-Timeout Retry Loop
            const MAX_RETRIES = 3;
            let attempt = 0;
            let savedOrderResult: Orders | null = null;
            let preparedItemsResult: Array<{ product: Product; quantity: number; unitPrice: number; selectedSize?: string }> = [];

            while (attempt < MAX_RETRIES) {
                attempt++;
                const queryRunner = this.dataSource.createQueryRunner();
                let isConnected = false;

                try {
                    await queryRunner.connect();
                    isConnected = true;
                    await queryRunner.startTransaction();

                    // Step A: Sequential Clustered-PK Row Locks in Strict ASC Order
                    const lockedProductMap = new Map<string, Product>();
                    for (const pid of sortedProductIds) {
                        const lockedProduct = await queryRunner.manager.findOne(Product, {
                            where: { id: pid, isDeleted: false },
                            lock: { mode: 'pessimistic_write' }
                        });

                        if (!lockedProduct) {
                            throw new HttpException(`Product with ID "${pid}" not found or inactive.`, HttpStatus.BAD_REQUEST);
                        }
                        lockedProductMap.set(pid, lockedProduct);
                    }

                    // Step B: Domain Consistency & Stock Sufficiency Validation
                    for (const pid of sortedProductIds) {
                        const product = lockedProductMap.get(pid)!;
                        const req = aggregatedMap.get(pid)!;

                        const availableStock = (product.quantity === null || product.quantity === undefined)
                            ? Number.MAX_SAFE_INTEGER
                            : Number(product.quantity);

                        if (availableStock < req.totalQty) {
                            throw new HttpException(
                                `Insufficient stock for product "${product.name}". Requested: ${req.totalQty}, Available: ${availableStock}.`,
                                HttpStatus.BAD_REQUEST
                            );
                        }

                        // Size Variant Consistency Check
                        if (product.sizeStock && typeof product.sizeStock === 'object' && Object.keys(product.sizeStock).length > 0) {
                            for (const [sizeName, neededQty] of req.sizeMap.entries()) {
                                if (!(sizeName in product.sizeStock)) {
                                    throw new HttpException(
                                        `Size variant "${sizeName}" is invalid for product "${product.name}".`,
                                        HttpStatus.BAD_REQUEST
                                    );
                                }
                                const currentVariantQty = Number(product.sizeStock[sizeName]) || 0;
                                if (currentVariantQty < neededQty) {
                                    throw new HttpException(
                                        `Insufficient stock for size "${sizeName}" of product "${product.name}". Requested: ${neededQty}, Available: ${currentVariantQty}.`,
                                        HttpStatus.BAD_REQUEST
                                    );
                                }
                            }
                        }
                    }

                    // Step C: MegaDiscount & Pricing Resolution
                    let megaDiscountRecord: MegaDiscount | null = null;
                    try {
                        megaDiscountRecord = await queryRunner.manager.findOne(MegaDiscount, {
                            where: { id: SINGLETON_MEGA_DISCOUNT_ID }
                        });
                    } catch {
                        megaDiscountRecord = null;
                    }

                    const isMegaDiscountApplied = Boolean(megaDiscountRecord?.isActive && Number(megaDiscountRecord?.discountPercentage) > 0);
                    const megaDiscountPercentage = isMegaDiscountApplied ? Number(megaDiscountRecord?.discountPercentage) : null;

                    let subtotal = 0;
                    const preparedItems: Array<{
                        product: Product;
                        quantity: number;
                        unitPrice: number;
                        selectedSize?: string;
                    }> = [];

                    for (const itemDto of rawItems) {
                        const pid = String(itemDto.productId || itemDto.id || itemDto.product).trim();
                        const qty = Number(itemDto.quantity);
                        const selectedSize = ((itemDto as any).size || (itemDto as any).selectedSize || (itemDto as any).sizeName || (itemDto as any).colorSize || '').trim();
                        const product = lockedProductMap.get(pid)!;

                        const unitPrice = ProductPricingResolver.resolveUnitPrice({
                            price: Number(product.price) || 0,
                            discountType: product.discountType,
                            discountAmount: Number(product.discountAmount) || 0
                        }, megaDiscountRecord);

                        subtotal += unitPrice * qty;

                        preparedItems.push({
                            product,
                            quantity: qty,
                            unitPrice,
                            selectedSize: selectedSize || undefined
                        });
                    }

                    // Delivery Charge Rule
                    let deliveryCharge = 120;
                    const city = (dto.shippingAddress?.city || '').toLowerCase();
                    if (city.includes('dhaka')) {
                        deliveryCharge = 60;
                    }

                    const uniqueOrderId = await this.uniqueCodeGeneratorService.getUniqueOrderId();

                    let discountAmount = 0;
                    let couponId: string | null = null;
                    let couponCode: string | null = null;

                    if (dto.couponCode && this.couponService) {
                        const couponRes = await this.couponService.redeemCouponInTransaction(
                            queryRunner,
                            dto.couponCode,
                            subtotal,
                            deliveryCharge,
                            userId,
                            uniqueOrderId
                        );
                        couponId = couponRes.couponId;
                        couponCode = couponRes.couponCode;
                        discountAmount = couponRes.discountAmount;
                    }

                    const subtotalRounded = Math.round((subtotal + Number.EPSILON) * 100) / 100;
                    const totalAmount = Math.max(0, Math.round((subtotalRounded + deliveryCharge - discountAmount + Number.EPSILON) * 100) / 100);

                    // Online payment amount security verification (prevents client price tampering)
                    if (finalPaymentMethod !== 'COD' && finalPaymentMethod !== 'SSLCOMMERZ' && !isOrderFirstStripe && finalPaymentIntentId && !finalPaymentIntentId.startsWith('cs_')) {
                        try {
                            const stripeClient = this.getStripeClient();
                            const intent = await stripeClient.paymentIntents.retrieve(finalPaymentIntentId);
                            if (intent && intent.amount !== undefined && intent.amount !== null) {
                                const paidCents = Number(intent.amount) || 0;
                                const expectedCents = Math.round(totalAmount * 100);
                                if (paidCents < expectedCents - 50) {
                                    throw new HttpException(
                                        `Payment verification failed: Amount paid ($${(paidCents / 100).toFixed(2)}) is less than required total ($${totalAmount.toFixed(2)}).`,
                                        HttpStatus.BAD_REQUEST
                                    );
                                }
                            }
                        } catch (err: unknown) {
                            if (err instanceof HttpException) throw err;
                        }
                    }

                    const nowIso = new Date().toISOString();

                    const initialStatusHistory = [
                        {
                            status: OrderStatus.PENDING,
                            timestamp: nowIso,
                            updatedBy: 'system',
                            note: couponCode
                                ? `Order submitted with coupon ${couponCode} (-৳${discountAmount}) - Pending Admin Approval`
                                : 'Order submitted by customer - Pending Admin Approval'
                        }
                    ];

                    const orderEntity = queryRunner.manager.create(Orders, {
                        orderId: uniqueOrderId,
                        userId,
                        paymentMethod: finalPaymentMethod,
                        paymentIntentId: finalPaymentIntentId,
                        totalAmount,
                        subtotal: subtotalRounded,
                        deliveryCharge,
                        couponId,
                        couponCode,
                        discountAmount,
                        megaDiscountApplied: isMegaDiscountApplied,
                        megaDiscountPercentage: megaDiscountPercentage,
                        currency: dto.currency || 'BDT',
                        status: OrderStatus.PENDING,
                        paymentStatus: finalPaymentStatus,
                        shippingAddress: dto.shippingAddress || null,
                        specialNote: dto.specialNote || null,
                        idempotencyKey: dto.idempotencyKey || null,
                        customerIntentFingerprint: intentFingerprint,
                        authoritativeSnapshot: {
                            subtotal: subtotalRounded,
                            deliveryCharge,
                            discountAmount,
                            totalAmount,
                            calculatedItems: preparedItems.map(p => ({
                                productId: p.product.id,
                                unitPrice: p.unitPrice,
                                quantity: p.quantity,
                                size: p.selectedSize || ''
                            }))
                        },
                        orderPaymentExpiresAt: new Date(Date.now() + 25 * 60 * 1000), // Harmonized 25 min window
                        statusHistory: initialStatusHistory
                    } as any);

                    const savedOrder = await queryRunner.manager.save(orderEntity);

                    for (const prepItem of preparedItems) {
                        const unitCostPrice = Number(prepItem.product.cost) > 0 ? Number(prepItem.product.cost) : 0;
                        const totalCost = Number((unitCostPrice * prepItem.quantity).toFixed(2));
                        const costSource = Number(prepItem.product.cost) > 0 ? CostSource.SNAPSHOT : CostSource.UNKNOWN;

                        const summaryEntity = queryRunner.manager.create(OrderSummary, {
                            orderId: savedOrder.id,
                            productId: prepItem.product.id,
                            productName: prepItem.product.name,
                            productImage: prepItem.product.featuredImage || '',
                            price: prepItem.unitPrice,
                            quantity: prepItem.quantity,
                            unitCostPrice,
                            totalCost,
                            costSource,
                            snapshotMainCategoryId: prepItem.product.mainCategoryId || null,
                            snapshotFirstCategoryId: prepItem.product.firstCategoryId || null,
                            snapshotSecondCategoryId: prepItem.product.secondCategoryId || null,
                            size: prepItem.selectedSize || null,
                            selectedSize: prepItem.selectedSize || null
                        } as any);
                        await queryRunner.manager.save(summaryEntity);
                    }

                    // Step D: Atomic Stock Deductions in Strict ASC Primary Key Order
                    for (const pid of sortedProductIds) {
                        const product = lockedProductMap.get(pid)!;
                        const req = aggregatedMap.get(pid)!;

                        let updatedSizeStock = product.sizeStock;
                        if (updatedSizeStock && typeof updatedSizeStock === 'object') {
                            updatedSizeStock = { ...updatedSizeStock };
                            for (const [sizeName, qtyNeeded] of req.sizeMap.entries()) {
                                const currentVariantQty = Number(updatedSizeStock[sizeName]) || 0;
                                updatedSizeStock[sizeName] = Math.max(0, currentVariantQty - qtyNeeded);
                            }
                        }

                        const newTotalQty = (product.quantity !== null && product.quantity !== undefined)
                            ? Math.max(0, (product.quantity || 0) - req.totalQty)
                            : 0;

                        await queryRunner.manager.update(Product, product.id, {
                            quantity: newTotalQty,
                            sizeStock: updatedSizeStock
                        });

                        product.quantity = newTotalQty;
                        product.sizeStock = updatedSizeStock;
                    }

                    if (this.notificationService) {
                        const customerName = dto.shippingAddress?.name || 'Customer';
                        await this.notificationService.createAdminOrderNotification(
                            queryRunner.manager,
                            {
                                orderId: savedOrder.id,
                                orderNumber: savedOrder.orderId,
                                customerName,
                                totalAmount: savedOrder.totalAmount,
                                paymentMethod: finalPaymentMethod
                            }
                        );
                    }

                    await queryRunner.commitTransaction();
                    savedOrderResult = savedOrder;
                    preparedItemsResult = preparedItems;
                    break; // Succeeded! Exit retry loop
                } catch (error: any) {
                    if (isConnected && queryRunner.isTransactionActive !== false) {
                        try {
                            await queryRunner.rollbackTransaction();
                        } catch (rbErr: any) {
                            this.logger.error(`[Order Create] Failed to rollback transaction: ${rbErr?.message}`);
                        }
                    }

                    const driverError = error?.driverError || error;
                    const errno = driverError?.errno || error?.errno;
                    const code = driverError?.code || error?.code;
                    const isDeadlock = errno === 1213 || code === 'ER_LOCK_DEADLOCK';
                    const isLockTimeout = errno === 1205 || code === 'ER_LOCK_WAIT_TIMEOUT';

                    if ((isDeadlock || isLockTimeout) && attempt < MAX_RETRIES) {
                        this.logger.warn(`[Order Create Concurrency] Contention detected (errno: ${errno}, code: ${code}) on attempt ${attempt}/${MAX_RETRIES}. Retrying with jittered exponential backoff...`);
                        const jitter = Math.floor(Math.random() * 50) + attempt * 50; // 50ms - 150ms backoff
                        await new Promise((resolve) => setTimeout(resolve, jitter));
                        continue;
                    }
                    throw error;
                } finally {
                    if (isConnected && queryRunner.isReleased !== true) {
                        try {
                            await queryRunner.release();
                        } catch (relErr: any) {
                            this.logger.error(`[Order Create] Failed to release query runner: ${relErr?.message}`);
                        }
                    }
                }
            }

            if (!savedOrderResult) {
                throw new HttpException('Unable to complete order transaction due to repeated concurrency contention.', HttpStatus.CONFLICT);
            }

            if (this.socketService) {
                try {
                    this.socketService.emitToRoom(SOCKET_ROOMS.ADMIN_ROOM, SocketEvent.ORDER_CREATED, {
                        orderId: savedOrderResult.id,
                        orderNumber: savedOrderResult.orderId,
                        totalAmount: savedOrderResult.totalAmount,
                        createdAt: savedOrderResult.createdAt ? new Date(savedOrderResult.createdAt).toISOString() : new Date().toISOString()
                    });

                    for (const prepItem of preparedItemsResult) {
                        if (prepItem.product?.id) {
                            this.socketService.emitToRoom(
                                SOCKET_ROOMS.PRODUCT(prepItem.product.id),
                                SocketEvent.STOCK_UPDATED,
                                {
                                    productId: prepItem.product.id,
                                    sizeStock: prepItem.product.sizeStock || null,
                                    totalQuantity: prepItem.product.quantity || 0
                                }
                            );
                        }
                    }
                } catch (socketErr) {
                    // Socket emission failure must not abort successful DB response
                }
            }

            return ResponseUtils.successResponseHandler(201, 'Order created successfully.', 'data', savedOrderResult);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const driverError = (error as any)?.driverError || error;
            const errno = driverError?.errno || (error as any)?.errno;
            const code = driverError?.code || (error as any)?.code;
            if (errno === 1213 || code === 'ER_LOCK_DEADLOCK' || errno === 1205 || code === 'ER_LOCK_WAIT_TIMEOUT') {
                throw new HttpException('High concurrency detected on stock reservation. Please try placing your order again in a few moments.', HttpStatus.CONFLICT);
            }
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

        async updateOrderStatus(
        id: string,
        dto: UpdateOrderStatusDto,
        adminUser?: any
    ): Promise<ApiResponse<Orders>> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const order = await queryRunner.manager.findOne(Orders, {
                where: { id },
                relations: ['orderSummaries'],
                lock: { mode: 'pessimistic_write' }
            });

            if (!order) {
                throw new HttpException('Order not found!', HttpStatus.NOT_FOUND);
            }

            const currentStatus = order.status;
            const targetStatus = dto.newStatus;

            // 1. Idempotency Early Exit
            if (currentStatus === targetStatus) {
                await queryRunner.rollbackTransaction();
                return ResponseUtils.successResponseHandler(200, 'Order status remains unchanged.', 'data', order);
            }

            // 2. State Machine Validation
            const isValidEnumStatus = Object.values(OrderStatus).includes(targetStatus as OrderStatus);
            if (!isValidEnumStatus) {
                throw new HttpException(
                    `Invalid target status "${targetStatus}".`,
                    HttpStatus.BAD_REQUEST
                );
            }

            const allowedNext = ALLOWED_ORDER_TRANSITIONS[currentStatus];
            if (allowedNext && !allowedNext.includes(targetStatus)) {
                throw new HttpException(
                    `Invalid status transition from "${currentStatus}" to "${targetStatus}".`,
                    HttpStatus.BAD_REQUEST
                );
            }

            // 3. Stock State Transition (Pessimistic Write Lock in ASC Clustered-PK Order)
            const wasDeducted = DEDUCTED_STATUS_GROUP.has(currentStatus);
            const willBeRestocked = RESTOCKED_STATUS_GROUP.has(targetStatus);

            if (wasDeducted && willBeRestocked) {
                const summaries = order.orderSummaries || [];
                const restockMap = new Map<string, { totalQty: number; sizeMap: Map<string, number> }>();

                for (const item of summaries) {
                    if (!item.productId) continue;
                    const pid = String(item.productId);
                    const qty = Math.max(1, Number(item.quantity) || 1);
                    const size = (item.size || (item as any).selectedSize || '').trim();

                    if (!restockMap.has(pid)) {
                        restockMap.set(pid, { totalQty: 0, sizeMap: new Map() });
                    }
                    const entry = restockMap.get(pid)!;
                    entry.totalQty += qty;
                    if (size) {
                        entry.sizeMap.set(size, (entry.sizeMap.get(size) || 0) + qty);
                    }
                }

                const sortedProductIds = Array.from(restockMap.keys()).sort();
                for (const pid of sortedProductIds) {
                    const product = await queryRunner.manager.findOne(Product, {
                        where: { id: pid },
                        lock: { mode: 'pessimistic_write' }
                    });

                    if (product) {
                        const req = restockMap.get(pid)!;
                        const currentQty = Number(product.quantity) || 0;
                        let updatedSizeStock = product.sizeStock;

                        if (updatedSizeStock && typeof updatedSizeStock === 'object') {
                            updatedSizeStock = { ...updatedSizeStock };
                            for (const [sizeName, qtyToReturn] of req.sizeMap.entries()) {
                                const curSizeQty = Number(updatedSizeStock[sizeName]) || 0;
                                updatedSizeStock[sizeName] = curSizeQty + qtyToReturn;
                            }
                        }

                        await queryRunner.manager.update(Product, product.id, {
                            quantity: currentQty + req.totalQty,
                            sizeStock: updatedSizeStock
                        });
                    }
                }
            }

            // 4. Update Order Fields
            order.status = targetStatus;

            if (targetStatus === OrderStatus.REJECTED || (targetStatus as string) === 'Rejected') {
                if (dto.rejectionReason) order.rejectionReason = dto.rejectionReason;
                if (dto.rejectionMessage) order.rejectionMessage = dto.rejectionMessage;
            }

            if ((order.paymentMethod || '').toUpperCase() === 'COD' && targetStatus === OrderStatus.DELIVERED) {
                order.paymentStatus = PaymentStatus.PAID;
            }

            const nowIso = new Date().toISOString();
            const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            const historyNote = dto.note || (
                targetStatus === OrderStatus.REJECTED || (targetStatus as string) === 'Rejected'
                    ? `Reason: ${dto.rejectionReason || 'Admin decision'}${dto.rejectionMessage ? ` - ${dto.rejectionMessage}` : ''}`
                    : `Status updated to ${targetStatus}`
            );

            history.push({
                status: targetStatus,
                timestamp: nowIso,
                updatedBy: adminUser?.role || 'admin',
                updatedByUserId: adminUser?.id || adminUser?.userId || '',
                note: historyNote
            });
            order.statusHistory = history;

            const updatedOrder = (await queryRunner.manager.save(order)) as Orders;

            await queryRunner.commitTransaction();

            if (this.socketService) {
                try {
                    const statusPayload = {
                        orderId: updatedOrder.id,
                        rawOrderId: updatedOrder.orderId,
                        status: targetStatus,
                        changedAt: nowIso,
                        note: historyNote
                    };
                    this.socketService.emitToRoom(SOCKET_ROOMS.ADMIN_ROOM, SocketEvent.ORDER_STATUS_UPDATED, statusPayload);
                    if (updatedOrder.userId) {
                        this.socketService.emitToRoom(SOCKET_ROOMS.USER(updatedOrder.userId), SocketEvent.ORDER_STATUS_UPDATED, statusPayload);
                    }
                } catch (socketErr) {
                    // Socket failure must not block response
                }
            }

            if (this.auditLogService) {
                this.auditLogService.createAsyncLog({
                    actorId: adminUser?.id || adminUser?.userId || null,
                    actorName: adminUser?.name || null,
                    actorEmail: adminUser?.email || null,
                    actorRole: adminUser?.role || 'admin',
                    action: AuditAction.ORDER_STATUS_UPDATED,
                    module: AuditModule.ORDER,
                    targetId: updatedOrder.id,
                    targetType: AuditTargetType.ORDER,
                    status: 'SUCCESS',
                    changes: {
                        type: 'FIELD_DIFF',
                        changedFields: {
                            status: { from: currentStatus, to: targetStatus }
                        }
                    }
                });
            }

            if (this.notificationService && updatedOrder?.userId) {
                const notifNote = targetStatus === OrderStatus.REJECTED || (targetStatus as string) === 'Rejected'
                    ? `Your order #${updatedOrder.orderId || updatedOrder.id} was rejected. Reason: ${dto.rejectionReason || 'Admin Decision'}${dto.rejectionMessage ? ` (${dto.rejectionMessage})` : ''}`
                    : dto.note || `Order status updated to "${targetStatus}"`;

                await this.notificationService.createOrderNotification(
                    updatedOrder.userId,
                    updatedOrder.orderId || updatedOrder.id,
                    targetStatus,
                    notifNote
                );
            }

            return ResponseUtils.successResponseHandler(200, 'Order status updated successfully.', 'data', updatedOrder);
        } catch (error: unknown) {
            if (queryRunner.isTransactionActive !== false) {
                try {
                    await queryRunner.rollbackTransaction();
                } catch (rbErr: any) {
                    this.logger.error(`[Order Status Update] Failed to rollback transaction: ${rbErr?.message}`);
                }
            }
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        } finally {
            if (queryRunner.isReleased !== true) {
                try {
                    await queryRunner.release();
                } catch (relErr: any) {
                    this.logger.error(`[Order Status Update] Failed to release query runner: ${relErr?.message}`);
                }
            }
        }
    }

    async updateCourierInfo(
        id: string,
        dto: UpdateCourierDto
    ): Promise<ApiResponse<Orders>> {
        try {
            const order = await this.repository.findOne(id);
            if (!order) {
                throw new HttpException('Order not found!', HttpStatus.NOT_FOUND);
            }

            order.courierName = dto.courierName;
            order.trackingId = dto.trackingId;
            order.courierTrackingLink = dto.courierTrackingLink || '';

            const updatedOrder = (await this.repository.save(order)) as Orders;

            if (this.socketService) {
                try {
                    const statusPayload = {
                        orderId: updatedOrder.id,
                        status: updatedOrder.status || 'Shipped',
                        changedAt: new Date().toISOString(),
                        note: `Courier updated: ${dto.courierName} (Tracking ID: ${dto.trackingId})`
                    };
                    this.socketService.emitToRoom(SOCKET_ROOMS.ADMIN_ROOM, SocketEvent.ORDER_STATUS_UPDATED, statusPayload);
                    if (updatedOrder.userId) {
                        this.socketService.emitToRoom(SOCKET_ROOMS.USER(updatedOrder.userId), SocketEvent.ORDER_STATUS_UPDATED, statusPayload);
                    }
                } catch (socketErr) {}
            }

            if (this.notificationService && updatedOrder?.userId) {
                await this.notificationService.createOrderNotification(
                    updatedOrder.userId,
                    updatedOrder.orderId || updatedOrder.id,
                    updatedOrder.status || 'Shipped',
                    `Courier updated: ${dto.courierName} (Tracking ID: ${dto.trackingId})`
                );
            }

            return ResponseUtils.successResponseHandler(200, 'Courier information updated successfully.', 'data', updatedOrder);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(
        dto: OrdersFilterDto
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
        try {
            const page = dto.page ? Math.max(1, Number(dto.page)) : 1;
            const limit = dto.limit ? Math.max(1, Number(dto.limit)) : 10;
            const skip = (page - 1) * limit;

            const qb = this.repository.createQueryBuilder('order')
                .leftJoinAndSelect('order.orderSummaries', 'orderSummaries')
                .leftJoinAndSelect('order.user', 'user')
                .leftJoinAndSelect('order.payments', 'payments')
                .where('order.isDeleted = false');

            if (dto.userId) {
                qb.andWhere('order.userId = :userId', { userId: dto.userId });
            }

            if (dto.status) {
                qb.andWhere('order.status = :status', { status: dto.status });
            }

            if (dto.paymentStatus) {
                qb.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: dto.paymentStatus });
            }

            if (dto.paymentMethod) {
                qb.andWhere('(order.paymentMethod = :paymentMethod OR payments.paymentMethod = :paymentMethod)', {
                    paymentMethod: dto.paymentMethod
                });
            }

            if (dto.trxId) {
                const cleanTrx = dto.trxId.trim();
                qb.andWhere('(payments.bankTranId LIKE :cleanTrx OR payments.tranId LIKE :cleanTrx)', {
                    cleanTrx: `%${cleanTrx}%`
                });
            }

            if (dto.search && dto.search.trim()) {
                const term = `%${dto.search.trim()}%`;
                qb.andWhere(
                    '(order.orderId LIKE :term OR payments.bankTranId LIKE :term OR payments.tranId LIKE :term OR JSON_UNQUOTE(JSON_EXTRACT(order.shippingAddress, "$.phone")) LIKE :term OR JSON_UNQUOTE(JSON_EXTRACT(order.shippingAddress, "$.name")) LIKE :term)',
                    { term }
                );
            }

            if (dto.orderId) {
                const cleanOrderId = dto.orderId.replace(/^#/, '').trim();
                qb.andWhere('order.orderId LIKE :orderId', { orderId: `%${cleanOrderId}%` });
            }

            if (dto.startDate && dto.endDate) {
                qb.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
                    startDate: new Date(dto.startDate),
                    endDate: new Date(dto.endDate)
                });
            } else if (dto.startDate) {
                qb.andWhere('order.createdAt >= :startDate', { startDate: new Date(dto.startDate) });
            } else if (dto.endDate) {
                qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(dto.endDate) });
            }

            qb.orderBy('order.createdAt', 'DESC')
              .addOrderBy('order.id', 'DESC')
              .skip(skip)
              .take(limit);

            const [orders, total] = await qb.getManyAndCount();
            const pageCount = Math.ceil(total / limit);

            let activeBlacklists: BlacklistEntity[] = [];
            if (this.blacklistService) {
                try {
                    activeBlacklists = await this.blacklistService.listBlacklists({ status: BlacklistStatusEnum.ACTIVE });
                } catch (riskErr) {
                    this.logger.warn(`Failed to retrieve active blacklists: ${riskErr instanceof Error ? riskErr.message : riskErr}`);
                    activeBlacklists = [];
                }
            }

            const enrichedData = (orders || []).map((order) => {
                const orderSummaries = order.orderSummaries || [];

                const totalCommission = orderSummaries.reduce(
                    (sum, item) => sum + Number(item.commissionAmount ?? 0),
                    0
                );

                let parsedShipping = order.shippingAddress;
                if (typeof parsedShipping === 'string') {
                    try { parsedShipping = JSON.parse(parsedShipping); } catch {}
                }
                const phone = (parsedShipping?.phone || order.user?.phone || '').replace(/\D/g, '');
                const email = (order.user?.email || parsedShipping?.email || '').trim().toLowerCase();
                const ip = ((order as any).ipAddress || '').trim();

                let isBlacklisted = false;
                let isSuspicious = false;

                for (const b of activeBlacklists) {
                    if (b.subjectType === BlacklistSubjectTypeEnum.PHONE && phone && b.displayValue) {
                        const bPhone = b.displayValue.replace(/\D/g, '');
                        if (bPhone && (phone.endsWith(bPhone) || bPhone.endsWith(phone))) {
                            if (b.severity === BlacklistSeverityEnum.HARD_BLOCK) isBlacklisted = true;
                            else isSuspicious = true;
                        }
                    }
                    if (b.customerEmail && email && b.customerEmail.toLowerCase() === email) {
                        if (b.severity === BlacklistSeverityEnum.HARD_BLOCK) isBlacklisted = true;
                        else isSuspicious = true;
                    }
                    if (b.subjectType === BlacklistSubjectTypeEnum.EXACT_IP && ip && b.ipAddress === ip) {
                        if (b.severity === BlacklistSeverityEnum.HARD_BLOCK) isBlacklisted = true;
                        else isSuspicious = true;
                    }
                }

                return {
                    ...order,
                    orderSummaries,
                    totalCommission,
                    isBlacklisted,
                    isSuspicious,
                    riskLevel: isBlacklisted ? 'CRITICAL' : isSuspicious ? 'HIGH' : 'LOW',
                    user: order.user ? toSafeUser(order.user) : null
                };
            });

            const payload = {
                data: enrichedData,
                total,
                page,
                limit,
                pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findCustomerOrderList(
        dto: OrdersFilterDto,
        userData: any
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number; statusCounts?: Record<string, number> }>> {
        try {
            const page = dto.page ? Math.max(1, Number(dto.page)) : 1;
            const limit = dto.limit ? Math.max(1, Number(dto.limit)) : 10;
            const skip = (page - 1) * limit;

            const qb = this.repository.createQueryBuilder('order')
                .leftJoinAndSelect('order.orderSummaries', 'orderSummaries')
                .leftJoinAndSelect('order.user', 'user')
                .where('order.isDeleted = false');

            const userId = userData?.id || userData?.userId || userData?.sub;
            if (userId) {
                qb.andWhere('order.userId = :userId', { userId });
            }

            if (dto.status) {
                qb.andWhere('order.status = :status', { status: dto.status });
            }

            if (dto.orderId) {
                const cleanOrderId = dto.orderId.replace(/^#/, '').trim();
                qb.andWhere('order.orderId LIKE :orderId', { orderId: `%${cleanOrderId}%` });
            }

            qb.orderBy('order.createdAt', 'DESC')
              .addOrderBy('order.id', 'DESC')
              .skip(skip)
              .take(limit);

            const [ordersList, total] = await qb.getManyAndCount();
            const pageCount = Math.ceil(total / limit);

            // Compute authoritative status counts across all orders for this customer
            const countsQb = this.repository.createQueryBuilder('order')
                .select('order.status', 'status')
                .addSelect('COUNT(order.id)', 'count')
                .where('order.isDeleted = false');

            if (userId) {
                countsQb.andWhere('order.userId = :userId', { userId });
            }

            const rawCounts = await countsQb.groupBy('order.status').getRawMany();
            const statusCounts: Record<string, number> = {
                All: 0,
                Pending: 0,
                'Order Placed': 0,
                Processing: 0,
                Shipped: 0,
                Delivered: 0,
                Cancelled: 0,
                Rejected: 0
            };

            let sumTotal = 0;
            for (const item of rawCounts) {
                const countNum = Number(item.count) || 0;
                sumTotal += countNum;
                if (item.status) {
                    statusCounts[item.status] = (statusCounts[item.status] || 0) + countNum;
                }
            }
            statusCounts.All = sumTotal;

            // Fix: Collect all productIds across all orders, fetch in one IN query
            const allProductIds = ordersList.flatMap(order =>
                (order.orderSummaries || []).map(s => s.productId).filter(Boolean)
            );

            const allProducts = allProductIds.length > 0
                ? await this.productRepository.findByIds(allProductIds)
                : [];

            const productFileUrlMap = new Map<string, string | null>(
                allProducts.map(p => [p.id, p.fileUrl ?? null])
            );

            const enrichedData = ordersList.map((order) => {
                const summariesWithFileUrl = (order.orderSummaries || []).map((summary) => ({
                    ...summary,
                    productFileUrl: productFileUrlMap.get(summary.productId) ?? null
                }));

                return {
                    ...order,
                    orderSummaries: summariesWithFileUrl
                };
            });

            const payload = {
                data: enrichedData,
                total,
                page,
                limit,
                pageCount,
                statusCounts
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findOne(id: string, userData?: any): Promise<ApiResponse<OrdersInterface>> {
        try {
            const cleanId = (id || '').replace(/^#/, '').trim();
            const data = await this.repository.getRepository().findOne({
                where: [
                    { id: cleanId, isDeleted: false },
                    { orderId: cleanId, isDeleted: false }
                ],
                relations: ['orderSummaries', 'user', 'payments']
            });
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.NOT_FOUND);
            }

            if (userData && userData.role === 'customer' && data.userId && data.userId !== userData.id) {
                throw new HttpException('Forbidden access to order.', HttpStatus.FORBIDDEN);
            }

            // Enrich summaries with calculated line item profit
            const enrichedSummaries = (data.orderSummaries || []).map((item) => {
                const unitCost = Number(item.unitCostPrice || 0);
                const itemQty = Number(item.quantity || 1);
                const itemPrice = Number(item.price || 0);
                const itemSubtotal = Number((itemPrice * itemQty).toFixed(2));
                const totalCost = Number(item.totalCost || (unitCost * itemQty).toFixed(2));
                const profit = unitCost > 0 ? Number((itemSubtotal - totalCost).toFixed(2)) : null;

                return {
                    ...item,
                    unitCostPrice: unitCost,
                    totalCost,
                    subtotal: itemSubtotal,
                    profit
                };
            });

            let riskEvaluation: {
                riskScore: number;
                riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
                policyDecision: 'ALLOW' | 'MANUAL_REVIEW' | 'HARD_BLOCK';
                fulfillmentHold: boolean;
                riskReviewStatus: 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'HARD_BLOCKED';
                isBlacklisted: boolean;
                isSuspicious: boolean;
                reason?: string;
            } = {
                riskScore: 0,
                riskLevel: 'LOW',
                policyDecision: 'ALLOW',
                fulfillmentHold: false,
                riskReviewStatus: 'NOT_REQUIRED',
                isBlacklisted: false,
                isSuspicious: false,
                reason: undefined
            };

            if (this.blacklistService) {
                try {
                    let parsedShipping = data.shippingAddress;
                    if (typeof parsedShipping === 'string') {
                        try { parsedShipping = JSON.parse(parsedShipping); } catch {}
                    }
                    const phone = parsedShipping?.phone || data.user?.phone || '';
                    const email = data.user?.email || parsedShipping?.email || '';
                    const ipAddress = (data as any).ipAddress || '';

                    riskEvaluation = await this.blacklistService.evaluateRiskForCustomer({
                        phone,
                        email,
                        ipAddress
                    });
                } catch (riskErr) {
                    this.logger.warn(`Failed to evaluate customer risk for order ${cleanId}: ${riskErr instanceof Error ? riskErr.message : riskErr}`);
                }
            }

            const enrichedData = {
                ...data,
                orderSummaries: enrichedSummaries,
                riskScore: riskEvaluation.riskScore,
                riskLevel: riskEvaluation.riskLevel,
                policyDecision: riskEvaluation.policyDecision,
                fulfillmentHold: riskEvaluation.fulfillmentHold,
                riskReviewStatus: riskEvaluation.riskReviewStatus,
                isBlacklisted: riskEvaluation.isBlacklisted,
                isSuspicious: riskEvaluation.isSuspicious,
                riskReason: riskEvaluation.reason
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', enrichedData);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(id: string, dto: UpdateOrdersDto): Promise<ApiResponse<Orders>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data does not exist!', HttpStatus.NOT_FOUND);
            }

            const response = await this.repository.update(id, dto as any);
            if (!response) {
                throw new HttpException('Something went wrong! Please try again.', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', response);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data not found!', HttpStatus.NOT_FOUND);
            }
            const response = await this.repository.softDelete(id);
            const result = response !== null;
            return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
