import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OrderExpiryWorker } from './order-expiry.worker';
import { SslcommerzService } from '../payments/services/sslcommerz.service';
import { Orders } from './entity/order.entity';
import { Payments } from '../payments/entities/payment.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { PaymentAttemptStatus, PaymentGateway } from '../payments/enums/payment.enum';

describe('OrderExpiryWorker', () => {
    let worker: OrderExpiryWorker;
    let mockDataSource: any;
    let mockSslcommerzService: any;
    let mockQueryRunner: any;
    let mockOrderRepo: any;
    let mockConfigService: any;

    beforeEach(async () => {
        mockOrderRepo = {
            find: jest.fn(),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockImplementation((q: string) => {
                if (q.includes('GET_LOCK')) {
                    return Promise.resolve([{ isLocked: 1 }]);
                }
                if (q.includes('RELEASE_LOCK')) {
                    return Promise.resolve([{ released: 1 }]);
                }
                return Promise.resolve([]);
            }),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                findOne: jest.fn(),
                find: jest.fn(),
                save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
                update: jest.fn().mockResolvedValue(undefined),
            },
        };

        mockDataSource = {
            getRepository: jest.fn().mockReturnValue(mockOrderRepo),
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        mockSslcommerzService = {
            queryTransaction: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn().mockReturnValue('mock-stripe-key'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrderExpiryWorker,
                { provide: DataSource, useValue: mockDataSource },
                { provide: SslcommerzService, useValue: mockSslcommerzService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        worker = module.get<OrderExpiryWorker>(OrderExpiryWorker);
    });

    it('should skip execution if MySQL advisory lock is held by another worker', async () => {
        mockQueryRunner.query.mockImplementationOnce(() => Promise.resolve([{ isLocked: 0 }]));

        await worker.handleExpiredOrders();

        expect(mockOrderRepo.find).not.toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should skip cancellation if any payment attempt is already PAID', async () => {
        const expiredCandidate: any = {
            id: 'ord-1',
            orderId: 'ORD-EX-001',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [
                {
                    status: PaymentAttemptStatus.PAID,
                },
            ],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);

        await worker.handleExpiredOrders();

        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should skip cancellation if any payment attempt needs admin review', async () => {
        const expiredCandidate: any = {
            id: 'ord-2',
            orderId: 'ORD-EX-002',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [
                {
                    status: PaymentAttemptStatus.PROCESSING,
                    needsAdminReview: true,
                },
            ],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);

        await worker.handleExpiredOrders();

        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should postpone cancellation if gateway query confirms payment is actually VALID on SSLCommerz', async () => {
        const expiredCandidate: any = {
            id: 'ord-3',
            orderId: 'ORD-EX-003',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [
                {
                    tranId: 'SSLCZ-ORD-003',
                    status: PaymentAttemptStatus.PENDING,
                    gateway: PaymentGateway.SSLCOMMERZ,
                },
            ],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'OK',
            element: [
                {
                    tran_id: 'SSLCZ-ORD-003',
                    status: 'VALID',
                },
            ],
        });

        await worker.handleExpiredOrders();

        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should postpone cancellation and keep order pending if SSLCommerz query throws timeout/network error', async () => {
        const expiredCandidate: any = {
            id: 'ord-timeout',
            orderId: 'ORD-TIMEOUT',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [
                {
                    tranId: 'SSLCZ-TIMEOUT',
                    status: PaymentAttemptStatus.PENDING,
                    gateway: PaymentGateway.SSLCOMMERZ,
                },
            ],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);
        mockSslcommerzService.queryTransaction.mockRejectedValueOnce(new Error('Gateway timeout'));

        await worker.handleExpiredOrders();

        // Must NOT attempt cancellation on gateway timeout
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should cancel expired unpaid order and restock inventory atomically', async () => {
        const candidatePayment: any = {
            id: 'pay-exp-4',
            tranId: 'SSLCZ-ORD-004',
            status: PaymentAttemptStatus.PENDING,
            gateway: PaymentGateway.SSLCOMMERZ,
        };

        const expiredCandidate: any = {
            id: 'ord-4',
            orderId: 'ORD-EX-004',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [candidatePayment],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'FAILED',
            element: [],
        });

        const lockedOrder: any = {
            id: 'ord-4',
            orderId: 'ORD-EX-004',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
        };

        const mockSummaries = [
            {
                productId: 'prod-4',
                quantity: 3,
                selectedSize: 'XL',
            },
        ];

        const mockProduct: any = {
            id: 'prod-4',
            quantity: 5,
            sizeStock: { XL: 2 },
        };

        mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
            if (entityClass === Orders) return Promise.resolve(lockedOrder);
            if (entityClass === Product) return Promise.resolve(mockProduct);
            return Promise.resolve(null);
        });

        mockQueryRunner.manager.find.mockImplementation((entityClass: any) => {
            if (entityClass === OrderSummary) return Promise.resolve(mockSummaries);
            if (entityClass === Payments) return Promise.resolve([candidatePayment]);
            return Promise.resolve([]);
        });

        await worker.handleExpiredOrders();

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(lockedOrder.status).toBe(OrderStatus.CANCELLED);
        expect(lockedOrder.paymentStatus).toBe(PaymentStatus.UNPAID);
        // Product restock: total was 5, 3 returned -> 8; sizeStock.XL was 2, 3 returned -> 5
        expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
            Product,
            'prod-4',
            expect.objectContaining({
                quantity: 8,
                sizeStock: expect.objectContaining({ XL: 5 }),
            })
        );
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
});
