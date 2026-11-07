import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SslcommerzService } from './services/sslcommerz.service';
import { PaymentConfirmationService } from './services/payment-confirmation.service';
import { Orders } from '../order/entity/order.entity';
import { Payments } from './entities/payment.entity';
import { PaymentRefunds } from './entities/payment-refund.entity';
import { PaymentAuditLogs } from './entities/payment-audit-log.entity';
import { PaymentOutboxEvents } from './entities/payment-outbox-event.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { OrderSummary } from '../order-summary/entity/order-summary.entity';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';
import { PaymentAttemptStatus, PaymentGateway, RefundStatus, OutboxStatus } from './enums/payment.enum';
import { Role } from '../../enums/role.enum';

describe('PaymentsService - Payment Retry & Expiry', () => {
    let service: PaymentsService;
    let mockOrderRepo: any;
    let mockPaymentRepo: any;
    let mockRefundRepo: any;
    let mockAuditRepo: any;
    let mockDataSource: any;
    let mockSslcommerzService: any;
    let mockConfigService: any;
    let mockQueryRunner: any;

    beforeEach(async () => {
        mockOrderRepo = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        };

        mockPaymentRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'pay-new' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    totalCollected: '5000.00',
                    totalCount: '10',
                    paidCount: '5',
                    pendingCount: '3',
                    failedCount: '2',
                    reviewCount: '1',
                }),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
        };

        mockRefundRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'ref-created-1' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    totalCount: '4',
                    pendingCount: '1',
                    succeededCount: '3',
                    totalRefundedAmount: '1200.00',
                }),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
        };

        mockAuditRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'audit-log-1' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            createQueryBuilder: jest.fn().mockReturnValue({
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
        };

        const mockOutboxRepo = {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 1 }),
            }),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                findOne: jest.fn(),
                find: jest.fn().mockResolvedValue([]),
                save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
                update: jest.fn().mockResolvedValue({ affected: 1 }),
                create: jest.fn().mockImplementation((cls: any, data: any) => ({ ...data, id: 'created-id-1' })),
            },
        };

        mockDataSource = {
            getRepository: jest.fn().mockImplementation((entity) => {
                if (entity === Orders) return mockOrderRepo;
                if (entity === Payments) return mockPaymentRepo;
                if (entity === PaymentRefunds) return mockRefundRepo;
                if (entity === PaymentAuditLogs) return mockAuditRepo;
                if (entity === PaymentOutboxEvents) return mockOutboxRepo;
                return { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn() };
            }),
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        mockSslcommerzService = {
            initiatePaymentSession: jest.fn().mockResolvedValue({
                status: 'SUCCESS',
                gatewayPageUrl: 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=test',
                sessionKey: 'SESSION-12345'
            }),
            validateTransaction: jest.fn(),
            queryTransaction: jest.fn(),
            initiateRefund: jest.fn().mockResolvedValue({
                status: 'success',
                refund_ref_id: 'GW-REF-999',
            }),
            queryRefund: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
                if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_123';
                if (key === 'BACKEND_PUBLIC_URL') return 'http://localhost:5000/api/v1';
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                { provide: ConfigService, useValue: mockConfigService },
                { provide: getRepositoryToken(Orders), useValue: mockOrderRepo },
                { provide: DataSource, useValue: mockDataSource },
                { provide: SslcommerzService, useValue: mockSslcommerzService },
                { provide: PaymentConfirmationService, useValue: {} },
            ],
        }).compile();

        service = module.get<PaymentsService>(PaymentsService);
    });

    describe('retryPayment', () => {
        it('should throw NotFoundException if order does not exist', async () => {
            mockOrderRepo.findOne.mockResolvedValue(null);

            await expect(service.retryPayment('ORD-NON-EXISTENT')).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if customer attempts to retry another customer order', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-actual-owner',
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
                payments: [],
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            await expect(
                service.retryPayment('ORD-1001', { id: 'user-malicious', role: Role.CUSTOMER })
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if order is already PAID', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.PAID,
                status: OrderStatus.ORDER_PLACED,
                payments: [],
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            await expect(
                service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER })
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if an active session was initiated within 2 minutes cooldown', async () => {
            const now = Date.now();
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
                payments: [
                    {
                        id: 'pay-recent',
                        status: PaymentAttemptStatus.PENDING,
                        createdAt: new Date(now - 30 * 1000), // 30 seconds ago
                    }
                ],
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            await expect(
                service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER })
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if any payment attempt is under review', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
                payments: [
                    {
                        id: 'pay-review',
                        status: PaymentAttemptStatus.PROCESSING,
                        needsAdminReview: true,
                        createdAt: new Date(Date.now() - 5 * 60 * 1000),
                    }
                ],
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            await expect(
                service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER })
            ).rejects.toThrow(BadRequestException);
        });

        it('should re-reserve stock and revive order to PENDING when retrying a CANCELLED order with available stock', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.UNPAID,
                status: OrderStatus.CANCELLED,
                totalAmount: '1200.00',
                payments: [
                    {
                        id: 'pay-old',
                        status: PaymentAttemptStatus.FAILED,
                        createdAt: new Date(Date.now() - 30 * 60 * 1000),
                    }
                ],
                orderSummaries: [
                    {
                        productId: 'prod-1',
                        quantity: 2,
                        selectedSize: 'L',
                    }
                ]
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            const mockProduct = {
                id: 'prod-1',
                quantity: 10,
                sizeStock: { L: 5 },
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Product) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
            });

            const result = await service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER });

            expect(result.gatewayPageUrl).toContain('sslcommerz.com');
            expect(result.orderId).toBe('ORD-1001');
            expect(result.attemptNumber).toBe(2);
            expect(mockOrder.status).toBe(OrderStatus.PENDING);
            expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
                Product,
                'prod-1',
                expect.objectContaining({
                    quantity: 8,
                    sizeStock: { L: 3 }
                })
            );
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should reject retry with out-of-stock message if stock is unavailable for a CANCELLED order', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.UNPAID,
                status: OrderStatus.CANCELLED,
                totalAmount: '1200.00',
                payments: [],
                orderSummaries: [
                    {
                        productId: 'prod-1',
                        quantity: 5,
                        selectedSize: 'L',
                    }
                ]
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            // Product has only 1 left (insufficient for 5 requested)
            const mockProduct = {
                id: 'prod-1',
                quantity: 1,
                sizeStock: { L: 1 },
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Product) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
            });

            await expect(
                service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER })
            ).rejects.toThrow(BadRequestException);

            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should successfully initiate fresh gateway session for an active PENDING order', async () => {
            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                userId: 'user-1',
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
                totalAmount: '1500.00',
                payments: [
                    {
                        id: 'pay-expired',
                        status: PaymentAttemptStatus.EXPIRED,
                        createdAt: new Date(Date.now() - 25 * 60 * 1000),
                    }
                ],
            };
            mockOrderRepo.findOne.mockResolvedValue(mockOrder);

            const result = await service.retryPayment('ORD-1001', { id: 'user-1', role: Role.CUSTOMER });

            expect(result.gatewayPageUrl).toBeDefined();
            expect(result.attemptNumber).toBe(2);
            expect(result.tranId).toContain('SSLCZ-ORD-1001-A2-');
            expect(mockPaymentRepo.save).toHaveBeenCalled();
        });
    });

    describe('initiateAdminRefund (Phase 5: Refund Safety & Financial Invariants)', () => {
        it('should throw NotFoundException if payment attempt does not exist', async () => {
            mockQueryRunner.manager.findOne.mockResolvedValue(null);

            await expect(
                service.initiateAdminRefund('pay-non-existent', 500, 'Customer return', 'admin-1')
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if payment status is NOT PAID', async () => {
            const mockPayment = {
                id: 'pay-pending',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
            };
            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);

            await expect(
                service.initiateAdminRefund('pay-pending', 500, 'Customer return', 'admin-1')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if an in-flight refund already exists (Barrier Protection)', async () => {
            const mockPayment = {
                id: 'pay-1',
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
            };
            const inFlightRefunds = [
                {
                    id: 'ref-1',
                    refundId: 'REF-001',
                    status: RefundStatus.PROCESSING, // In-flight barrier!
                    amount: '300.00',
                }
            ];

            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);
            mockQueryRunner.manager.find.mockResolvedValue(inFlightRefunds);

            await expect(
                service.initiateAdminRefund('pay-1', 200, 'Second refund', 'admin-1')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if requested refund amount exceeds remaining refundable balance', async () => {
            const mockPayment = {
                id: 'pay-1',
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
            };
            const existingRefunds = [
                {
                    id: 'ref-1',
                    status: RefundStatus.SUCCEEDED,
                    amount: '800.00', // 800 already refunded out of 1000!
                }
            ];

            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);
            mockQueryRunner.manager.find.mockResolvedValue(existingRefunds);

            // Requesting 300 when only 200 is remaining
            await expect(
                service.initiateAdminRefund('pay-1', 300, 'Over-refund attempt', 'admin-1')
            ).rejects.toThrow(BadRequestException);
        });

        it('should return existing refund idempotently if idempotencyKey already exists', async () => {
            const mockPayment = {
                id: 'pay-1',
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
            };
            const existingRefunds = [
                {
                    id: 'ref-idempotent',
                    refundId: 'REF-IDEM-001',
                    status: RefundStatus.SUCCEEDED,
                    amount: '500.00',
                    idempotencyKey: 'idemp-key-12345',
                }
            ];

            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);
            mockQueryRunner.manager.find.mockResolvedValue(existingRefunds);

            const result = await service.initiateAdminRefund('pay-1', 500, 'Duplicate call', 'admin-1', 'idemp-key-12345');

            expect(result.success).toBe(true);
            expect(result.message).toContain('idempotent');
            expect(result.refund?.id).toBe('ref-idempotent');
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should successfully initiate refund, call SSLCommerz API, and log audit log', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                bankTranId: 'BANK-TR-123',
                gateway: PaymentGateway.SSLCOMMERZ,
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
                order: { orderId: 'ORD-1001' }
            };

            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);
            mockQueryRunner.manager.find.mockResolvedValue([]);

            const result = await service.initiateAdminRefund('pay-1', 500, 'Quality defect return', 'admin-1');

            expect(result.success).toBe(true);
            expect(mockSslcommerzService.initiateRefund).toHaveBeenCalledWith(expect.objectContaining({
                bankTranId: 'BANK-TR-123',
                refundAmount: '500.00',
            }));
            expect(result.refund?.status).toBe(RefundStatus.PROCESSING);
            expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentAuditLogs,
                expect.objectContaining({
                    action: 'ADMIN_INITIATE_REFUND',
                    actorId: 'admin-1',
                })
            );
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should mark refund as UNKNOWN when gateway refund API times out (Network Fault-Tolerance)', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                bankTranId: 'BANK-TR-123',
                gateway: PaymentGateway.SSLCOMMERZ,
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
                order: { orderId: 'ORD-1001' }
            };

            mockQueryRunner.manager.findOne.mockResolvedValue(mockPayment);
            mockQueryRunner.manager.find.mockResolvedValue([]);

            // Simulate SSLCommerz refund API network timeout
            mockSslcommerzService.initiateRefund.mockRejectedValue(new Error('Gateway socket timeout'));

            const result = await service.initiateAdminRefund('pay-1', 500, 'Gateway lag return', 'admin-1');

            expect(result.success).toBe(true);
            expect(result.refund?.status).toBe(RefundStatus.UNKNOWN);
            expect(result.refund?.failureReason).toContain('Awaiting reconciliation');
        });
    });

    describe('adminRefundAction (Phase 5: Status Progression & Audit Logging)', () => {
        it('should mark refund as SUCCEEDED, update order to REFUNDED if full, and insert audit log', async () => {
            const mockOrder = {
                id: 'ord-1',
                paymentStatus: PaymentStatus.PAID,
            };
            const mockPayment = {
                id: 'pay-1',
                amount: '500.00',
                order: mockOrder,
            };
            const mockRefund = {
                id: 'ref-1',
                refundId: 'REF-001',
                paymentId: 'pay-1',
                status: RefundStatus.PENDING,
                amount: '500.00',
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === PaymentRefunds) return Promise.resolve(mockRefund);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockResolvedValue([mockRefund]);

            const result = await service.adminRefundAction('ref-1', 'MARK_SUCCEEDED', 'Settled via MFS', 'admin-1');

            expect(result.success).toBe(true);
            expect(mockRefund.status).toBe(RefundStatus.SUCCEEDED);
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.REFUNDED);
            expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentAuditLogs,
                expect.objectContaining({
                    action: 'ADMIN_REFUND_MARK_SUCCEEDED',
                    actorId: 'admin-1',
                })
            );
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should mark order as PARTIALLY_REFUNDED if total succeeded refunds are less than paid amount', async () => {
            const mockOrder = {
                id: 'ord-1',
                paymentStatus: PaymentStatus.PAID,
            };
            const mockPayment = {
                id: 'pay-1',
                amount: '1000.00', // Total paid is 1000
                order: mockOrder,
            };
            const mockRefund = {
                id: 'ref-1',
                refundId: 'REF-001',
                paymentId: 'pay-1',
                status: RefundStatus.PENDING,
                amount: '300.00', // Only 300 refunded!
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === PaymentRefunds) return Promise.resolve(mockRefund);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockResolvedValue([mockRefund]);

            const result = await service.adminRefundAction('ref-1', 'MARK_SUCCEEDED', 'Partial refund approved', 'admin-1');

            expect(result.success).toBe(true);
            expect(mockRefund.status).toBe(RefundStatus.SUCCEEDED);
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.PARTIALLY_REFUNDED);
        });

        it('should mark refund as FAILED and insert audit log', async () => {
            const mockRefund = {
                id: 'ref-1',
                refundId: 'REF-001',
                paymentId: 'pay-1',
                status: RefundStatus.PENDING,
                amount: '300.00',
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === PaymentRefunds) return Promise.resolve(mockRefund);
                return Promise.resolve(null);
            });

            const result = await service.adminRefundAction('ref-1', 'MARK_FAILED', 'Account number invalid', 'admin-1');

            expect(result.success).toBe(true);
            expect(mockRefund.status).toBe(RefundStatus.FAILED);
            expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentAuditLogs,
                expect.objectContaining({
                    action: 'ADMIN_REFUND_MARK_FAILED',
                    actorId: 'admin-1',
                })
            );
        });
    });

    describe('getAuditLogs', () => {
        it('should return paginated audit logs', async () => {
            const result = await service.getAuditLogs({ page: 1, limit: 10 });

            expect(result.statusCode).toBe(200);
            expect(result.message).toContain('Audit logs retrieved');
            expect(result.data?.page).toBe(1);
            expect(result.data?.limit).toBe(10);
        });
    });

    describe('getPaymentMetrics & getRefundMetrics (Phase 7: Metrics Separation)', () => {
        it('should return aggregated payment metrics without requiring paginated queries', async () => {
            const result = await service.getPaymentMetrics();

            expect(result.statusCode).toBe(200);
            expect(result.data.totalCollected).toBe(5000);
            expect(result.data.totalCount).toBe(10);
            expect(result.data.paidCount).toBe(5);
            expect(result.data.pendingCount).toBe(3);
            expect(result.data.failedCount).toBe(2);
            expect(result.data.reviewCount).toBe(1);
        });

        it('should return aggregated refund metrics without requiring paginated queries', async () => {
            const result = await service.getRefundMetrics();

            expect(result.statusCode).toBe(200);
            expect(result.data.totalCount).toBe(4);
            expect(result.data.pendingCount).toBe(1);
            expect(result.data.succeededCount).toBe(3);
            expect(result.data.totalRefundedAmount).toBe(1200);
        });
    });

    describe('Phase 2: Stripe Payment Lifecycle', () => {
        let mockStripe: any;

        beforeEach(() => {
            mockStripe = {
                paymentIntents: {
                    create: jest.fn(),
                    retrieve: jest.fn(),
                },
                webhooks: {
                    constructEvent: jest.fn(),
                },
            };
            (service as any).stripe = mockStripe;
        });

        describe('initiateStripePayment', () => {
            it('should throw NotFoundException if order does not exist', async () => {
                mockOrderRepo.findOne.mockResolvedValue(null);
                await expect(service.initiateStripePayment('order-not-found')).rejects.toThrow(NotFoundException);
            });

            it('should throw ForbiddenException if order belongs to a different non-admin user', async () => {
                mockOrderRepo.findOne.mockResolvedValue({
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    userId: 'user-owner',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                });

                await expect(
                    service.initiateStripePayment('ord-1', { id: 'different-user', role: Role.CUSTOMER })
                ).rejects.toThrow(ForbiddenException);
            });

            it('should throw BadRequestException if order is already PAID', async () => {
                mockOrderRepo.findOne.mockResolvedValue({
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    paymentStatus: PaymentStatus.PAID,
                });

                await expect(service.initiateStripePayment('ord-1')).rejects.toThrow(BadRequestException);
            });

            it('should throw BadRequestException if order is CANCELLED', async () => {
                mockOrderRepo.findOne.mockResolvedValue({
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.CANCELLED,
                });

                await expect(service.initiateStripePayment('ord-1')).rejects.toThrow(BadRequestException);
            });

            it('should reuse active unexpired intent if one exists within 20 mins', async () => {
                const futureDate = new Date(Date.now() + 15 * 60 * 1000);
                mockOrderRepo.findOne.mockResolvedValue({
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                    payments: [
                        {
                            gateway: PaymentGateway.STRIPE,
                            status: PaymentAttemptStatus.PENDING,
                            tranId: 'pi_active_123',
                            sessionExpiresAt: futureDate,
                        },
                    ],
                });

                mockStripe.paymentIntents.retrieve.mockResolvedValue({
                    id: 'pi_active_123',
                    client_secret: 'pi_active_123_secret_xyz',
                    status: 'requires_payment_method',
                });

                const result = await service.initiateStripePayment('ord-1');

                expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_active_123');
                expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
                expect(result).toEqual({
                    clientSecret: 'pi_active_123_secret_xyz',
                    orderId: 'ORD-1',
                    tranId: 'pi_active_123',
                });
            });

            it('should create a new attempt and Stripe PaymentIntent with attempt-specific idempotency key', async () => {
                const mockOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    userId: 'user-1',
                    totalAmount: '49.99',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                    payments: [],
                };
                mockOrderRepo.findOne.mockResolvedValue(mockOrder);

                mockStripe.paymentIntents.create.mockResolvedValue({
                    id: 'pi_new_999',
                    client_secret: 'pi_new_999_secret_abc',
                    status: 'requires_payment_method',
                });

                const result = await service.initiateStripePayment('ord-1', { id: 'user-1', role: Role.CUSTOMER });

                expect(mockPaymentRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        orderId: 'ord-1',
                        gateway: PaymentGateway.STRIPE,
                        currency: 'USD',
                        status: PaymentAttemptStatus.PENDING,
                    })
                );
                expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        amount: 4999,
                        currency: 'usd',
                        metadata: expect.objectContaining({
                            orderId: 'ord-1',
                            orderNumber: 'ORD-1',
                        }),
                    }),
                    expect.objectContaining({
                        idempotencyKey: expect.stringMatching(/^stripe_pi_ord-1_/),
                    })
                );
                expect(result.clientSecret).toBe('pi_new_999_secret_abc');
                expect(result.tranId).toBe('pi_new_999');
            });
        });

        describe('handleWebhookEvent', () => {
            it('should process payment_intent.succeeded with exact minor-unit match and confirm order', async () => {
                const event = {
                    type: 'payment_intent.succeeded',
                    data: {
                        object: {
                            id: 'pi_webhook_123',
                            amount: 5000,
                            currency: 'usd',
                            metadata: {
                                orderId: 'ord-1',
                                attemptId: 'pay-att-1',
                            },
                        },
                    },
                };

                mockStripe.webhooks.constructEvent.mockReturnValue(event);

                const mockDbOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    totalAmount: '50.00',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                };
                const mockDbPayment = {
                    id: 'pay-att-1',
                    orderId: 'ord-1',
                    tranId: 'pi_webhook_123',
                    amount: '50.00',
                    currency: 'USD',
                    status: PaymentAttemptStatus.PENDING,
                };

                mockOrderRepo.findOne.mockResolvedValue(mockDbOrder);
                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);
                mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                    if (entity === Orders) return Promise.resolve({ ...mockDbOrder });
                    if (entity === Payments) return Promise.resolve({ ...mockDbPayment });
                    return Promise.resolve(null);
                });

                const res = await service.handleWebhookEvent(Buffer.from('payload'), 'sig-header');

                expect(res).toEqual({ received: true });
                expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        status: OrderStatus.ORDER_PLACED,
                        paymentStatus: PaymentStatus.PAID,
                        paymentIntentId: 'pi_webhook_123',
                    })
                );
                expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            });

            it('should mark REVIEW_REQUIRED if payment_intent.succeeded has an amount tampering mismatch', async () => {
                const event = {
                    type: 'payment_intent.succeeded',
                    data: {
                        object: {
                            id: 'pi_tampered_123',
                            amount: 100, // $1.00 instead of $50.00
                            currency: 'usd',
                            metadata: {
                                orderId: 'ord-1',
                                attemptId: 'pay-att-1',
                            },
                        },
                    },
                };

                mockStripe.webhooks.constructEvent.mockReturnValue(event);

                const mockDbOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1',
                    totalAmount: '50.00',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                };
                const mockDbPayment = {
                    id: 'pay-att-1',
                    orderId: 'ord-1',
                    tranId: 'pi_tampered_123',
                    amount: '50.00',
                    currency: 'USD',
                    status: PaymentAttemptStatus.PENDING,
                };

                mockOrderRepo.findOne.mockResolvedValue(mockDbOrder);
                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);
                mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                    if (entity === Orders) return Promise.resolve({ ...mockDbOrder });
                    if (entity === Payments) return Promise.resolve({ ...mockDbPayment });
                    return Promise.resolve(null);
                });

                await service.handleWebhookEvent(Buffer.from('payload'), 'sig-header');

                expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        paymentStatus: PaymentStatus.REVIEW_REQUIRED,
                    })
                );
            });

            it('should mark payment attempt FAILED on payment_intent.payment_failed without cancelling order', async () => {
                const event = {
                    type: 'payment_intent.payment_failed',
                    data: {
                        object: {
                            id: 'pi_failed_123',
                            last_payment_error: {
                                message: 'Card declined: Insufficient funds',
                            },
                            metadata: {
                                orderId: 'ord-1',
                                attemptId: 'pay-att-1',
                            },
                        },
                    },
                };

                mockStripe.webhooks.constructEvent.mockReturnValue(event);

                const mockDbPayment = {
                    id: 'pay-att-1',
                    orderId: 'ord-1',
                    status: PaymentAttemptStatus.PENDING,
                };

                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);

                await service.handleWebhookEvent(Buffer.from('payload'), 'sig-header');

                expect(mockPaymentRepo.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: 'pay-att-1',
                        status: PaymentAttemptStatus.FAILED,
                        failureReason: 'Card declined: Insufficient funds',
                    })
                );
            });
        });
    });

    describe('Phase 4: Admin Verified Reconciliation & Dead-Letter Replay', () => {
        let mockStripe: any;

        beforeEach(() => {
            mockStripe = {
                paymentIntents: {
                    create: jest.fn(),
                    retrieve: jest.fn(),
                },
            };
            (service as any).stripe = mockStripe;
        });

        describe('adminVerifiedReconciliation', () => {
            it('should return immediately if payment is already marked as PAID', async () => {
                const mockPayment = {
                    id: 'pay-1',
                    status: PaymentAttemptStatus.PAID,
                };
                mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

                const result = await service.adminVerifiedReconciliation('pay-1');

                expect(result.success).toBe(true);
                expect(result.message).toContain('already marked as PAID');
                expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
            });

            it('should reconcile Stripe payment with exact minor unit match, update DB, and log sanitized audit trail', async () => {
                const mockDbPayment = {
                    id: 'pay-stripe-1',
                    tranId: 'pi_test_reconcile_123',
                    orderId: 'ord-1',
                    amount: '75.00',
                    currency: 'USD',
                    gateway: PaymentGateway.STRIPE,
                    status: PaymentAttemptStatus.PENDING,
                };
                const mockDbOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-75',
                    totalAmount: '75.00',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                };

                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);
                mockOrderRepo.findOne.mockResolvedValue(mockDbOrder);

                mockStripe.paymentIntents.retrieve.mockResolvedValue({
                    id: 'pi_test_reconcile_123',
                    amount: 7500,
                    currency: 'usd',
                    status: 'succeeded',
                    client_secret: 'pi_secret_SHOULD_BE_SANITIZED',
                });

                mockQueryRunner.manager.findOne.mockImplementation((cls: any) => {
                    if (cls === Orders) return Promise.resolve({ ...mockDbOrder });
                    if (cls === Payments) return Promise.resolve({ ...mockDbPayment });
                    return Promise.resolve(null);
                });

                const result = await service.adminVerifiedReconciliation('pay-stripe-1', { id: 'admin-1', role: 'admin' });

                expect(result.success).toBe(true);
                expect(result.message).toContain('reconciled and confirmed');
                expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        paymentStatus: PaymentStatus.PAID,
                        status: OrderStatus.ORDER_PLACED,
                    })
                );
                expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            });

            it('should flag needsAdminReview if reconciled Stripe amount has a mismatch', async () => {
                const mockDbPayment = {
                    id: 'pay-stripe-2',
                    tranId: 'pi_mismatch_123',
                    orderId: 'ord-2',
                    amount: '100.00',
                    currency: 'USD',
                    gateway: PaymentGateway.STRIPE,
                    status: PaymentAttemptStatus.PENDING,
                };
                const mockDbOrder = {
                    id: 'ord-2',
                    orderId: 'ORD-100',
                    totalAmount: '100.00',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                    status: OrderStatus.PENDING,
                };

                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);
                mockOrderRepo.findOne.mockResolvedValue(mockDbOrder);

                // Settled 5000 cents ($50) instead of $100
                mockStripe.paymentIntents.retrieve.mockResolvedValue({
                    id: 'pi_mismatch_123',
                    amount: 5000,
                    currency: 'usd',
                    status: 'succeeded',
                });

                const result = await service.adminVerifiedReconciliation('pay-stripe-2', { id: 'admin-1' });

                expect(result.success).toBe(false);
                expect(result.discrepancy).toBe('AMOUNT_MISMATCH');
                expect(mockPaymentRepo.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        needsAdminReview: true,
                    })
                );
            });

            it('should mark attempt CANCELLED if Stripe reports canceled', async () => {
                const mockDbPayment = {
                    id: 'pay-stripe-3',
                    tranId: 'pi_canceled_123',
                    orderId: 'ord-3',
                    amount: '50.00',
                    currency: 'USD',
                    gateway: PaymentGateway.STRIPE,
                    status: PaymentAttemptStatus.PENDING,
                };
                const mockDbOrder = {
                    id: 'ord-3',
                    orderId: 'ORD-3',
                    totalAmount: '50.00',
                    currency: 'USD',
                    paymentStatus: PaymentStatus.UNPAID,
                };

                mockPaymentRepo.findOne.mockResolvedValue(mockDbPayment);
                mockOrderRepo.findOne.mockResolvedValue(mockDbOrder);

                mockStripe.paymentIntents.retrieve.mockResolvedValue({
                    id: 'pi_canceled_123',
                    amount: 5000,
                    currency: 'usd',
                    status: 'canceled',
                });

                const result = await service.adminVerifiedReconciliation('pay-stripe-3', { id: 'admin-1' });

                expect(result.success).toBe(false);
                expect(result.message).toContain('Stripe confirmed payment is canceled');
                expect(mockPaymentRepo.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        status: PaymentAttemptStatus.CANCELLED,
                    })
                );
            });
        });

        describe('replayOutboxEvent', () => {
            it('should atomically re-queue dead-letter outbox event and record audit log', async () => {
                const mockEvent = {
                    id: 'outbox-failed-1',
                    eventType: 'ORDER_CONFIRMATION',
                    aggregateType: 'ORDER',
                    aggregateId: 'ORD-1',
                    status: OutboxStatus.FAILED,
                    retryCount: 5,
                    replayCount: 0,
                    failureReason: 'Downstream webhook timeout',
                };

                const outboxRepo = mockDataSource.getRepository(PaymentOutboxEvents);
                outboxRepo.findOne.mockResolvedValue(mockEvent);

                const result = await service.replayOutboxEvent('outbox-failed-1', { id: 'admin-1', role: 'admin' });

                expect(result.success).toBe(true);
                expect(result.message).toContain('re-queued for delivery');
                expect(mockAuditRepo.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        action: 'REPLAY_OUTBOX_EVENT',
                        actorId: 'admin-1',
                        previousState: OutboxStatus.FAILED,
                        newState: OutboxStatus.PENDING,
                    })
                );
            });
        });
    });
});
