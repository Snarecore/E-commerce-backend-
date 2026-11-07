import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './order.service';
import { OrdersRepository } from './order.repository';
import { OrderSummaryRepository } from '../order-summary/order-summary.repository';
import { ProductRepository } from '../inventory/product/product.repository';
import { UniqueCodeGeneratorService } from '../unique-code-generator/unique-code-generator.service';
import { DataSource } from 'typeorm';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { HttpException } from '@nestjs/common';
import { MegaDiscount } from '../setting/mega-discount/entities/mega-discount.entity';
import { Orders } from './entity/order.entity';
import { Product } from '../inventory/product/entities/product.entity';

describe('OrdersService', () => {
    let service: OrdersService;
    let repositoryMock: any;
    let uniqueCodeGeneratorServiceMock: any;
    let queryRunnerMock: any;

    beforeEach(async () => {
        repositoryMock = {
            findOneByQuery: jest.fn(),
            findOne: jest.fn(),
            findOneWithRelations: jest.fn(),
            save: jest.fn((entity) => Promise.resolve({ id: 'order-uuid-1', ...entity })),
            create: jest.fn((data) => data)
        };

        uniqueCodeGeneratorServiceMock = {
            getUniqueOrderId: jest.fn().mockResolvedValue('BB123456')
        };

        queryRunnerMock = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                find: jest.fn().mockImplementation((entityClass) => {
                    return Promise.resolve([]);
                }),
                findOne: jest.fn().mockImplementation(async (entityClass, options) => {
                    if (entityClass === Product || options?.where?.id) {
                        const targetId = options?.where?.id;
                        const products = await queryRunnerMock.manager.find(Product);
                        if (Array.isArray(products) && products.length > 0) {
                            const match = products.find((p: any) => p.id === targetId);
                            if (match) return match;
                        }
                    }
                    return null;
                }),
                create: jest.fn((entityClass, data) => data),
                save: jest.fn((data) => Promise.resolve({ id: 'saved-id-1', ...data })),
                update: jest.fn().mockResolvedValue({ affected: 1 }),
                createQueryBuilder: jest.fn().mockReturnValue({
                    update: jest.fn().mockReturnThis(),
                    set: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    execute: jest.fn().mockResolvedValue({ affected: 1 })
                })
            }
        };

        const dataSourceMock = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock)
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: DataSource, useValue: dataSourceMock },
                { provide: UniqueCodeGeneratorService, useValue: uniqueCodeGeneratorServiceMock },
                { provide: OrdersRepository, useValue: repositoryMock },
                { provide: OrderSummaryRepository, useValue: {} },
                { provide: ProductRepository, useValue: {} }
            ]
        }).compile();

        service = module.get<OrdersService>(OrdersService);

        // Mock Stripe retrieve
        (service as any).stripe = {
            paymentIntents: {
                retrieve: jest.fn()
            },
            checkout: {
                sessions: {
                    retrieve: jest.fn()
                }
            }
        };
    });

    it('TEST 1: COD order creation should bypass Stripe and set paymentStatus to Pending', async () => {
        const product = {
            id: 'product-1',
            name: 'Test T-Shirt',
            price: 500,
            quantity: 10,
            discountType: 'NONE',
            discountAmount: 0,
            vendorId: 'vendor-1'
        };

        queryRunnerMock.manager.find.mockResolvedValue([product]);

        const dto = {
            paymentMethod: 'COD',
            items: [{ productId: 'product-1', quantity: 2 }],
            shippingAddress: { city: 'Dhaka', name: 'Karim', phone: '01700000000', address: 'Banani' }
        };

        const result = await service.create(dto as any, 'user-1');
        const data = result.data as any;

        expect(result.statusCode).toBe(201);
        expect(data.paymentMethod).toBe('COD');
        expect(data.paymentStatus).toBe(PaymentStatus.PENDING);
        expect(data.subtotal).toBe(1000); // 500 * 2
        expect(data.deliveryCharge).toBe(60); // Inside Dhaka
        expect(data.totalAmount).toBe(1060);
        expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
        expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('TEST 2: Online successful payment verifies Stripe and sets paymentStatus to Paid', async () => {
        const product = {
            id: 'product-2',
            name: 'Jeans',
            price: 1200,
            quantity: 5,
            discountType: 'NONE',
            discountAmount: 0,
            vendorId: 'vendor-1'
        };

        queryRunnerMock.manager.find.mockResolvedValue([product]);
        (service as any).stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });

        const dto = {
            paymentMethod: 'Online',
            paymentIntentId: 'pi_success_123',
            items: [{ productId: 'product-2', quantity: 1 }],
            shippingAddress: { city: 'Chittagong', name: 'Rahim', phone: '01800000000', address: 'GEC' }
        };

        const result = await service.create(dto as any, 'user-1');
        const data = result.data as any;

        expect(result.statusCode).toBe(201);
        expect(data.paymentStatus).toBe(PaymentStatus.PAID);
        expect(data.deliveryCharge).toBe(120); // Outside Dhaka
    });

    it('TEST 3: Online failed payment throws error and rolls back transaction', async () => {
        (service as any).stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'requires_payment_method' });

        const dto = {
            paymentMethod: 'Online',
            paymentIntentId: 'pi_failed_123',
            items: [{ productId: 'product-1', quantity: 1 }]
        };

        await expect(service.create(dto as any, 'user-1')).rejects.toThrow('Payment not completed on Stripe.');
        expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });

    it('TEST 4: COD Delivered automatically updates paymentStatus to Paid via strict state transition', async () => {
        const existingOrder = {
            id: 'order-1',
            paymentMethod: 'COD',
            paymentStatus: PaymentStatus.PENDING,
            status: OrderStatus.SHIPPED,
            statusHistory: [],
            orderSummaries: []
        };

        queryRunnerMock.manager.findOne.mockResolvedValue(existingOrder);

        const result = await service.updateOrderStatus('order-1', {
            newStatus: OrderStatus.DELIVERED,
            note: 'Package handed over to customer'
        });
        const data = result.data as any;

        expect(data.status).toBe(OrderStatus.DELIVERED);
        expect(data.paymentStatus).toBe(PaymentStatus.PAID);
        expect(data.statusHistory.length).toBe(1);
        expect(data.statusHistory[0].status).toBe(OrderStatus.DELIVERED);
        expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('TEST 5: Duplicate request with idempotencyKey returns existing order', async () => {
        const existingOrder = { id: 'order-idempotent-1', idempotencyKey: 'key-123' };
        repositoryMock.findOneByQuery.mockResolvedValue(existingOrder);

        const dto = { idempotencyKey: 'key-123', paymentMethod: 'COD', items: [{ productId: 'p1', quantity: 1 }] };

        const result = await service.create(dto as any, 'user-1');

        expect(result.data).toEqual(existingOrder);
        expect(queryRunnerMock.startTransaction).not.toHaveBeenCalled();
    });

    it('TEST 6: Updating to same status is idempotent and does not add duplicate statusHistory entry', async () => {
        const existingOrder = {
            id: 'order-1',
            status: OrderStatus.DELIVERED,
            statusHistory: [{ status: OrderStatus.DELIVERED }],
            orderSummaries: []
        };

        queryRunnerMock.manager.findOne.mockResolvedValue(existingOrder);

        const result = await service.updateOrderStatus('order-1', { newStatus: OrderStatus.DELIVERED });

        expect(result.message).toBe('Order status remains unchanged.');
        expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
    });

    it('TEST 7: Customer unauthorized order access throws 403 Forbidden', async () => {
        const order = { id: 'order-1', userId: 'user-owner' };
        repositoryMock.findOneWithRelations.mockResolvedValue(order);

        const userData = { id: 'user-other', role: 'customer' };

        await expect(service.findOne('order-1', userData)).rejects.toThrow(HttpException);
    });

    it('TEST 8: Insufficient stock throws error and rolls back transaction', async () => {
        const product = {
            id: 'product-1',
            name: 'Low Stock Item',
            price: 100,
            quantity: 1
        };

        queryRunnerMock.manager.find.mockResolvedValue([product]);

        const dto = {
            paymentMethod: 'COD',
            items: [{ productId: 'product-1', quantity: 5 }]
        };

        await expect(service.create(dto as any, 'user-1')).rejects.toThrow('Insufficient stock for product "Low Stock Item".');
        expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
        expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('TEST 9: Online payment with clientSecret strips _secret_ and retrieves pure paymentIntent ID', async () => {
        const product = { id: 'p1', name: 'Shirt', price: 200, quantity: 5 };
        queryRunnerMock.manager.find.mockResolvedValue([product]);
        (service as any).stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });

        const dto = {
            paymentMethod: 'Online',
            paymentIntentId: 'pi_real123_secret_clientsecret456',
            items: [{ productId: 'p1', quantity: 1 }]
        };

        const result = await service.create(dto as any, 'user-1');
        const data = result.data as any;

        expect((service as any).stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_real123');
        expect(data.paymentIntentId).toBe('pi_real123');
    });

    it('TEST 10: Online payment with Stripe Checkout Session ID (cs_...) retrieves session correctly', async () => {
        const product = { id: 'p1', name: 'Shirt', price: 200, quantity: 5 };
        queryRunnerMock.manager.find.mockResolvedValue([product]);
        (service as any).stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'paid',
            payment_intent: 'pi_resolved_from_session_789'
        });

        const dto = {
            paymentMethod: 'Online',
            stripeSessionId: 'cs_test_session_123',
            items: [{ productId: 'p1', quantity: 1 }]
        };

        const result = await service.create(dto as any, 'user-1');
        const data = result.data as any;

        expect((service as any).stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_session_123');
        expect(data.paymentIntentId).toBe('pi_resolved_from_session_789');
    });

    it('TEST 10b: Online payment with tampered amount throws error and rejects order', async () => {
        const product = { id: 'p1', name: 'Shirt', price: 200, quantity: 5 };
        queryRunnerMock.manager.find.mockResolvedValue([product]);
        (service as any).stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded', amount: 100 }); // Paid 100 cents ($1.00) instead of required amount

        const dto = {
            paymentMethod: 'Online',
            paymentIntentId: 'pi_tampered_123',
            items: [{ productId: 'p1', quantity: 1 }]
        };

        await expect(service.create(dto as any, 'user-1')).rejects.toThrow('Payment verification failed');
    });

    it('TEST 11: Invalid State Machine status jump throws 400 Bad Request', async () => {
        const existingOrder = {
            id: 'order-1',
            status: OrderStatus.DELIVERED,
            statusHistory: [],
            orderSummaries: []
        };

        queryRunnerMock.manager.findOne.mockResolvedValue(existingOrder);

        // DELIVERED cannot transition back to PENDING
        await expect(service.updateOrderStatus('order-1', { newStatus: OrderStatus.PENDING })).rejects.toThrow(
            'Invalid status transition from "Delivered" to "Pending".'
        );
        expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('TEST 12: Order cancellation idempotently restocks product quantity and sizeStock with pessimistic lock', async () => {
        const existingOrder = {
            id: 'order-1',
            status: OrderStatus.PENDING,
            statusHistory: [],
            orderSummaries: [
                {
                    productId: 'prod-1',
                    quantity: 2,
                    size: 'L'
                }
            ]
        };

        const product = {
            id: 'prod-1',
            quantity: 5,
            sizeStock: { L: 3, M: 2 }
        };

        queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
            if (options?.where?.id === 'order-1') {
                return Promise.resolve(existingOrder);
            }
            if (options?.where?.id === 'prod-1') {
                return Promise.resolve(product);
            }
            return Promise.resolve(null);
        });

        const result = await service.updateOrderStatus('order-1', {
            newStatus: OrderStatus.CANCELLED,
            note: 'Customer requested cancellation'
        });

        expect(queryRunnerMock.manager.update).toHaveBeenCalledWith(
            Product,
            'prod-1',
            {
                quantity: 7, // 5 + 2
                sizeStock: { L: 5, M: 2 } // 3 + 2
            }
        );
        expect(result.statusCode).toBe(200);
        expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('TEST 13: Order-First Stripe flow creates order in PENDING status without calling Stripe API upfront', async () => {
        const product = {
            id: 'product-order-first',
            name: 'Order-First Item',
            price: 1500,
            quantity: 10,
            discountType: 'NONE',
            discountAmount: 0,
            vendorId: 'vendor-1'
        };

        queryRunnerMock.manager.find.mockResolvedValue([product]);

        const dto = {
            paymentMethod: 'Online',
            paymentIntentId: 'PENDING_STRIPE',
            items: [{ productId: 'product-order-first', quantity: 1 }],
            shippingAddress: { city: 'Dhaka', name: 'Zaman', phone: '01900000000', address: 'Dhanmondi' }
        };

        const result = await service.create(dto as any, 'user-1');
        const data = result.data as any;

        expect(result.statusCode).toBe(201);
        expect(data.paymentMethod).toBe('Online');
        expect(data.paymentStatus).toBe(PaymentStatus.PENDING);
        expect(data.paymentIntentId).toBeNull();
        expect((service as any).stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('TEST 14: Deadlock ER_LOCK_DEADLOCK triggers exponential backoff retry and succeeds on next attempt', async () => {
        const product = {
            id: 'product-deadlock',
            name: 'Deadlock Test Item',
            price: 800,
            quantity: 5,
            discountType: 'NONE',
            discountAmount: 0
        };

        let attemptsMade = 0;
        queryRunnerMock.manager.findOne.mockImplementation(async (entityClass: any, options: any) => {
            if (entityClass === Product || options?.where?.id === 'product-deadlock') {
                attemptsMade++;
                if (attemptsMade === 1) {
                    const deadlockErr: any = new Error('Deadlock found when trying to get lock; try restarting transaction');
                    deadlockErr.errno = 1213;
                    deadlockErr.code = 'ER_LOCK_DEADLOCK';
                    throw deadlockErr;
                }
                return product;
            }
            return null;
        });

        const dto = {
            paymentMethod: 'COD',
            items: [{ productId: 'product-deadlock', quantity: 1 }],
            shippingAddress: { city: 'Dhaka', name: 'Customer', phone: '01700000000', address: 'Gulshan' }
        };

        const result = await service.create(dto as any, 'user-1');

        expect(result.statusCode).toBe(201);
        expect(attemptsMade).toBeGreaterThanOrEqual(2);
        expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('TEST 15: Lock wait timeout ER_LOCK_WAIT_TIMEOUT exhausts all 3 retries and throws 409 Conflict', async () => {
        let attemptsMade = 0;
        queryRunnerMock.manager.findOne.mockImplementation(async () => {
            attemptsMade++;
            const timeoutErr: any = new Error('Lock wait timeout exceeded; try restarting transaction');
            timeoutErr.errno = 1205;
            timeoutErr.code = 'ER_LOCK_WAIT_TIMEOUT';
            throw timeoutErr;
        });

        const dto = {
            paymentMethod: 'COD',
            items: [{ productId: 'product-timeout', quantity: 1 }]
        };

        await expect(service.create(dto as any, 'user-1')).rejects.toThrow(
            'High concurrency detected on stock reservation. Please try placing your order again in a few moments.'
        );
        expect(attemptsMade).toBe(3);
        expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(3);
    });

    it('TEST 16: Order cancellation with multiple items of same product aggregates total and sizeStock restock in strict ASC order', async () => {
        const existingOrder = {
            id: 'order-multi',
            status: OrderStatus.PENDING,
            statusHistory: [],
            orderSummaries: [
                { productId: 'prod-z', quantity: 2, size: 'M' },
                { productId: 'prod-a', quantity: 1, size: 'L' },
                { productId: 'prod-z', quantity: 3, size: 'XL' }
            ]
        };

        const prodA = { id: 'prod-a', quantity: 10, sizeStock: { L: 5 } };
        const prodZ = { id: 'prod-z', quantity: 20, sizeStock: { M: 4, XL: 2 } };

        const lockedOrderList: string[] = [];
        queryRunnerMock.manager.findOne.mockImplementation((entityClass: any, options: any) => {
            if (options?.where?.id === 'order-multi') return Promise.resolve(existingOrder);
            if (options?.where?.id === 'prod-a') {
                lockedOrderList.push('prod-a');
                return Promise.resolve(prodA);
            }
            if (options?.where?.id === 'prod-z') {
                lockedOrderList.push('prod-z');
                return Promise.resolve(prodZ);
            }
            return Promise.resolve(null);
        });

        const result = await service.updateOrderStatus('order-multi', {
            newStatus: OrderStatus.CANCELLED,
            note: 'Multi-item cancellation'
        });

        expect(result.statusCode).toBe(200);
        // Strict ASC Clustered PK ordering: 'prod-a' must be locked before 'prod-z'
        expect(lockedOrderList).toEqual(['prod-a', 'prod-z']);
        // prod-a restock: 10 + 1 = 11, sizeStock.L = 5 + 1 = 6
        expect(queryRunnerMock.manager.update).toHaveBeenCalledWith(
            Product,
            'prod-a',
            { quantity: 11, sizeStock: { L: 6 } }
        );
        // prod-z aggregated restock: 20 + 2 (M) + 3 (XL) = 25, sizeStock: M: 4+2=6, XL: 2+3=5
        expect(queryRunnerMock.manager.update).toHaveBeenCalledWith(
            Product,
            'prod-z',
            { quantity: 25, sizeStock: { M: 6, XL: 5 } }
        );
    });
});
