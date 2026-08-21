import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import Stripe from 'stripe';
import { Between, FindOptionsOrder, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { OrdersRepository } from './order.repository';
import { CreateOrdersDto } from './dto/create-order.dto';
import { OrdersInterface } from './type/order.type';
import { Orders } from './entity/order.entity';
import { OrdersFilterDto } from './dto/order-filter.dto';
import { OrdersFilter } from './type/order-filter.type';
import { UpdateOrdersDto } from './dto/update.order.dto';
import { UniqueCodeGeneratorService } from '../unique-code-generator/unique-code-generator.service';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { OrderStatus, PaymentStatus } from 'src/enums/order-status.enum';
import { toSafeUser } from 'src/utils/safe-user.utils';
import { ProductRepository } from '../inventory/product/product.repository';
import { unitAfterDiscount } from 'src/utils/helper.utils';

@Injectable()
export class OrdersService {
    private stripe: Stripe;

    constructor(
        private readonly uniqueCodeGeneratorService: UniqueCodeGeneratorService,
        private readonly repository: OrdersRepository,
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly productRepository: ProductRepository
    ) {
        const secretKey = process.env.STRIPE_SECRET_KEY || process.env.API_SECRET_KEY || '';
        this.stripe = new Stripe(secretKey);
    }

    async create(dto: CreateOrdersDto, id: any): Promise<ApiResponse<OrdersInterface>> {
        try {
            const userId = id;
            const uniqueOrderId = await this.uniqueCodeGeneratorService.getUniqueOrderId();

            const intent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);
            if (intent.status !== 'succeeded') {
                throw new Error('Payment not completed.');
            }

            const orderData = {
                ...dto,
                orderId: uniqueOrderId,
                userId: userId,
                status: OrderStatus.COMPLETED,
                paymentStatus: PaymentStatus.PAID
            };

            const data = await this.repository.create(orderData);
            if (!data) {
                throw new HttpException('Failed to create order.', HttpStatus.INTERNAL_SERVER_ERROR);
            }
            for (const item of dto.products) {
                const unitPrice = unitAfterDiscount({
                    price: item.price,
                    discountType: item.discountType,
                    discountAmount: item.discountAmount
                });

                await this.orderSummaryRepository.create({
                    orderId: data.id,
                    productId: item.id,
                    productName: item.name,
                    productImage: item.featuredImage || '',
                    price: unitPrice,
                    quantity: item.quantity,
                    vendorId: item.vendorId || '',
                    commissionAmount: 0
                });

                // Deduct product stock/quantity
                const product = await this.productRepository.findOne(item.id);
                if (product) {
                    const newQuantity = Math.max(0, (product.quantity ?? 0) - item.quantity);
                    await this.productRepository.update(product.id, { quantity: newQuantity });
                }
            }

            return ResponseUtils.successResponseHandler(201, 'Order created successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(
        dto: OrdersFilterDto
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
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
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findCustomerOrderList(
        dto: OrdersFilterDto,
        userData: any
    ): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
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
                                productFileUrl: product?.fileUrl || null // only attach fileUrl
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
                .map(order => {
                    const vendorSummaries = order.orderSummaries?.filter(
                        summary => summary.vendorId === userData.id
                    ) || [];

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
                .filter(order => order !== null);

            const payload = {
                data: filteredOrders,
                total: filteredOrders.length,
                page: result.page,
                limit: result.limit,
                pageCount: Math.ceil(filteredOrders.length / result.limit)
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findOne(id: string): Promise<ApiResponse<OrdersInterface>> {
        try {
            const data = await this.repository.findOneWithRelations(id, ['orderSummaries'])
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async update(
        id: string,
        dto: UpdateOrdersDto
    ): Promise<ApiResponse<Orders>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
            }

            const response = await this.repository.update(id, dto);
            if (!response) {
                throw new HttpException(
                    'Something went wrong! Please try again.',
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', response);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
        try {
            const output = await this.repository.findOne(id);
            if (!output) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }
            const response = await this.repository.softDelete(id);
            const result = response !== null;
            return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
