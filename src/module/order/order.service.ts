import { HttpException, HttpStatus, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import Stripe from 'stripe';
import { Between, DataSource, FindOptionsOrder, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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
import { OrderStatus, PaymentStatus } from 'src/enums/order-status.enum';
import { toSafeUser } from 'src/utils/safe-user.utils';
import { ProductRepository } from '../inventory/product/product.repository';
import { Product } from '../inventory/product/entities/product.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { unitAfterDiscount } from 'src/utils/helper.utils';
import { NotificationService } from '../notification/notification.service';
import { CouponService } from '../coupon/coupon.service';

@Injectable()
export class OrdersService implements OnModuleInit {
    private stripe: Stripe;

    constructor(
        private readonly dataSource: DataSource,
        private readonly uniqueCodeGeneratorService: UniqueCodeGeneratorService,
        private readonly repository: OrdersRepository,
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly productRepository: ProductRepository,
        @Optional() private readonly notificationService?: NotificationService,
        @Optional() private readonly configService?: ConfigService,
        @Optional() private readonly couponService?: CouponService
    ) {}

    async onModuleInit() {
        try {
            await (this.repository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionReason\` varchar(255) NULL`);
        } catch (e) {}
        try {
            await (this.repository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionMessage\` text NULL`);
        } catch (e) {}
    }

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

    async create(dto: CreateOrdersDto, userId: string): Promise<ApiResponse<OrdersInterface>> {
        try {
            // 1. Idempotency Check
            if (dto.idempotencyKey) {
                const existingOrder = await this.repository.findOneByQuery({
                    idempotencyKey: dto.idempotencyKey
                });
                if (existingOrder) {
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

            const finalPaymentMethod = isCOD ? 'COD' : dto.paymentMethod || 'Online';
            let finalPaymentIntentId: string | null = null;
            let finalPaymentStatus: PaymentStatus = PaymentStatus.PENDING;

            if (isCOD) {
                // Completely bypass Stripe for COD
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

            // 3. Process Items
            const rawItems = dto.items && dto.items.length > 0 ? dto.items : dto.products || [];
            if (!rawItems || rawItems.length === 0) {
                throw new HttpException('Order must contain at least one item.', HttpStatus.BAD_REQUEST);
            }

            // 4. Execute Atomic Database Transaction
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                let subtotal = 0;
                const preparedItems: Array<{
                    product: Product;
                    quantity: number;
                    unitPrice: number;
                }> = [];

                for (const itemDto of rawItems) {
                    const productId = itemDto.productId || itemDto.id || itemDto.product;
                    if (!productId) {
                        throw new HttpException('Product ID is missing in order item.', HttpStatus.BAD_REQUEST);
                    }

                    const qty = Number(itemDto.quantity) || 0;
                    if (qty <= 0) {
                        throw new HttpException(`Invalid quantity for product ${productId}.`, HttpStatus.BAD_REQUEST);
                    }

                    let product: Product | null = null;
                    try {
                        product = await queryRunner.manager.findOne(Product, {
                            where: { id: productId, isDeleted: false }
                        });
                    } catch {
                        product = null;
                    }

                    if (!product) {
                        throw new HttpException(`Product with ID ${productId} not found.`, HttpStatus.NOT_FOUND);
                    }

                    const availableStock = (product.quantity === null || product.quantity === undefined || product.quantity === 0)
                        ? 100
                        : product.quantity;

                    if (availableStock < qty) {
                        throw new HttpException(
                            `Insufficient stock for product "${product.name}". Requested: ${qty}, Available: ${availableStock}.`,
                            HttpStatus.BAD_REQUEST
                        );
                    }

                    const unitPrice = unitAfterDiscount({
                        price: Number(product.price) || 0,
                        discountType: product.discountType,
                        discountAmount: Number(product.discountAmount) || 0
                    });

                    subtotal += unitPrice * qty;

                    preparedItems.push({
                        product,
                        quantity: qty,
                        unitPrice
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

                const totalAmount = Math.max(0, subtotal + deliveryCharge - discountAmount);
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
                    subtotal,
                    deliveryCharge,
                    couponId,
                    couponCode,
                    discountAmount,
                    currency: dto.currency || 'BDT',
                    status: OrderStatus.PENDING,
                    paymentStatus: finalPaymentStatus,
                    shippingAddress: dto.shippingAddress || null,
                    specialNote: dto.specialNote || null,
                    idempotencyKey: dto.idempotencyKey || null,
                    statusHistory: initialStatusHistory
                } as any);

                const savedOrder = await queryRunner.manager.save(orderEntity);

                for (const prepItem of preparedItems) {
                    const summaryEntity = queryRunner.manager.create(OrderSummary, {
                        orderId: savedOrder.id,
                        productId: prepItem.product.id,
                        productName: prepItem.product.name,
                        productImage: prepItem.product.featuredImage || '',
                        price: prepItem.unitPrice,
                        quantity: prepItem.quantity,
                        vendorId: prepItem.product.vendorId || '',
                        commissionAmount: 0
                    } as any);
                    await queryRunner.manager.save(summaryEntity);

                    // Deduct stock
                    const currentStock = (prepItem.product.quantity === null || prepItem.product.quantity === undefined || prepItem.product.quantity === 0)
                        ? 100
                        : prepItem.product.quantity;
                    prepItem.product.quantity = Math.max(0, currentStock - prepItem.quantity);
                    await queryRunner.manager.save(prepItem.product);
                }

                await queryRunner.commitTransaction();

                return ResponseUtils.successResponseHandler(201, 'Order created successfully.', 'data', savedOrder);
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateOrderStatus(
        id: string,
        dto: UpdateOrderStatusDto,
        adminUser?: any
    ): Promise<ApiResponse<Orders>> {
        try {
            const order = await this.repository.findOne(id);
            if (!order) {
                throw new HttpException('Order not found!', HttpStatus.NOT_FOUND);
            }

            if (order.status === dto.newStatus) {
                return ResponseUtils.successResponseHandler(200, 'Order status remains unchanged.', 'data', order);
            }

            order.status = dto.newStatus;

            // Ensure rejection columns exist in MySQL schema
            try {
                await (this.repository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionReason\` varchar(255) NULL`);
            } catch (e) {}
            try {
                await (this.repository as any).query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionMessage\` text NULL`);
            } catch (e) {}

            if (dto.newStatus === OrderStatus.REJECTED || (dto.newStatus as string) === 'Rejected') {
                if (dto.rejectionReason) order.rejectionReason = dto.rejectionReason;
                if (dto.rejectionMessage) order.rejectionMessage = dto.rejectionMessage;
            }

            // COD Auto-Payment on Delivered
            if ((order.paymentMethod || '').toUpperCase() === 'COD' && dto.newStatus === OrderStatus.DELIVERED) {
                order.paymentStatus = PaymentStatus.PAID;
            }

            const nowIso = new Date().toISOString();
            const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
            const historyNote = dto.note || (
                dto.newStatus === OrderStatus.REJECTED || (dto.newStatus as string) === 'Rejected'
                    ? `Reason: ${dto.rejectionReason || 'Admin decision'}${dto.rejectionMessage ? ` - ${dto.rejectionMessage}` : ''}`
                    : `Status updated to ${dto.newStatus}`
            );

            history.push({
                status: dto.newStatus,
                timestamp: nowIso,
                updatedBy: adminUser?.role || 'admin',
                updatedByUserId: adminUser?.id || adminUser?.userId || '',
                note: historyNote
            });
            order.statusHistory = history;

            const updatedOrder = (await this.repository.save(order)) as Orders;

            if (this.notificationService && updatedOrder?.userId) {
                const notifNote = dto.newStatus === OrderStatus.REJECTED || (dto.newStatus as string) === 'Rejected'
                    ? `Your order #${updatedOrder.orderId || updatedOrder.id} was rejected. Reason: ${dto.rejectionReason || 'Admin Decision'}${dto.rejectionMessage ? ` (${dto.rejectionMessage})` : ''}`
                    : dto.note || `Order status updated to "${dto.newStatus}"`;

                await this.notificationService.createOrderNotification(
                    updatedOrder.userId,
                    updatedOrder.orderId || updatedOrder.id,
                    dto.newStatus,
                    notifNote
                );
            }

            return ResponseUtils.successResponseHandler(200, 'Order status updated successfully.', 'data', updatedOrder);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
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
            let query: OrdersFilter = {};

            if (dto.userId) {
                query.userId = dto.userId;
            }

            if (dto.vendorId) {
                query.vendorId = dto.vendorId;
            }

            if (dto.status) {
                query.status = dto.status;
            }

            if (dto.paymentStatus) {
                query.paymentStatus = dto.paymentStatus;
            }

            if (dto.startDate && dto.endDate) {
                query.createdAt = Between(new Date(dto.startDate), new Date(dto.endDate));
            } else if (dto.startDate) {
                query.createdAt = MoreThanOrEqual(new Date(dto.startDate));
            } else if (dto.endDate) {
                query.createdAt = LessThanOrEqual(new Date(dto.endDate));
            }

            const order: FindOptionsOrder<Orders> = {
                createdAt: 'desc'
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order,
                relations: ['orderSummaries', 'user']
            });

            const enrichedData = result?.data?.map((order) => {
                const orderSummaries = order.orderSummaries || [];

                const totalCommission = orderSummaries.reduce(
                    (sum, item) => sum + Number(item.commissionAmount ?? 0),
                    0
                );

                return {
                    ...order,
                    orderSummaries,
                    totalCommission,
                    user: order.user ? toSafeUser(order.user) : null
                };
            });

            const payload = {
                data: enrichedData,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
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
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
        try {
            let query: OrdersFilter = {};

            if (userData.id) {
                query.userId = userData.id;
            }

            const order: FindOptionsOrder<Orders> = {
                createdAt: 'desc'
            };

            const result = await this.repository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order,
                relations: ['orderSummaries', 'user']
            });

            const enrichedData = await Promise.all(
                result.data.map(async (order) => {
                    const summariesWithFileUrl = await Promise.all(
                        (order.orderSummaries || []).map(async (summary) => {
                            const product = await this.productRepository.findOne(summary.productId);
                            return {
                                ...summary,
                                productFileUrl: product?.fileUrl || null
                            };
                        })
                    );

                    return {
                        ...order,
                        orderSummaries: summariesWithFileUrl
                    };
                })
            );

            const payload = {
                data: enrichedData,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            if (error instanceof HttpException) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findVendorOrderList(
        dto: OrdersFilterDto,
        userData: any
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
        try {
            const order: FindOptionsOrder<Orders> = {
                createdAt: 'desc'
            };

            const result = await this.repository.paginate({
                page: dto.page || 1,
                limit: dto.limit || 10,
                order,
                relations: ['orderSummaries', 'user']
            });

            const filteredOrders = result.data
                .map((order) => {
                    const vendorSummaries =
                        order.orderSummaries?.filter((summary) => summary.vendorId === userData.id) || [];

                    if (vendorSummaries.length === 0) return null;

                    const vendorTotalAmount = vendorSummaries.reduce(
                        (sum, item) => sum + Number(item.price) * item.quantity,
                        0
                    );

                    const vendorTotalCommission = vendorSummaries.reduce(
                        (sum, item) => sum + Number(item.commissionAmount ?? 0),
                        0
                    );

                    return {
                        ...order,
                        orderSummaries: vendorSummaries,
                        vendorTotalAmount,
                        vendorTotalCommission,
                        user: toSafeUser(order.user)
                    };
                })
                .filter((order) => order !== null);

            const payload = {
                data: filteredOrders,
                total: filteredOrders.length,
                page: result.page,
                limit: result.limit,
                pageCount: Math.ceil(filteredOrders.length / result.limit)
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
            const data = await this.repository.findOneWithRelations(id, ['orderSummaries', 'user']);
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.NOT_FOUND);
            }

            if (userData && userData.role === 'customer' && data.userId !== userData.id) {
                throw new HttpException('Forbidden access to order.', HttpStatus.FORBIDDEN);
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
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
