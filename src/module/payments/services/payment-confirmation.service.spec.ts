import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PaymentConfirmationService } from './payment-confirmation.service';
import { SslcommerzService } from './sslcommerz.service';
import { Orders } from '../../order/entity/order.entity';
import { Payments } from '../entities/payment.entity';
import { PaymentEvents } from '../entities/payment-event.entity';
import { PaymentRefunds } from '../entities/payment-refund.entity';
import { PaymentAttemptStatus, PaymentEventSource, PaymentMethodType, RefundStatus } from '../enums/payment.enum';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { Product } from '../../inventory/product/entities/product.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';

describe('PaymentConfirmationService', () => {
    let service: PaymentConfirmationService;
    let mockDataSource: any;
    let mockSslcommerzService: any;
    let mockQueryRunner: any;
    let mockQueryBuilder: any;

    beforeEach(async () => {
        mockQueryBuilder = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                findOne: jest.fn(),
                find: jest.fn(),
                save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
                update: jest.fn().mockResolvedValue({ affected: 1 }),
                create: jest.fn().mockImplementation((entityClass, data) => ({ ...data })),
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            },
        };

        mockDataSource = {
            getRepository: jest.fn(),
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        mockSslcommerzService = {
            validateTransaction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentConfirmationService,
                { provide: DataSource, useValue: mockDataSource },
                { provide: SslcommerzService, useValue: mockSslcommerzService },
            ],
        }).compile();

        service = module.get<PaymentConfirmationService>(PaymentConfirmationService);
    });

    describe('confirmPayment', () => {
        it('should return idempotent success when initial payment read is already PAID', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PAID,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Payment already confirmed');
            expect(result.paymentStatus).toBe('PAID');
            expect(mockSslcommerzService.validateTransaction).not.toHaveBeenCalled();
            expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
        });

        it('should return pending/unknown if gateway validation throws a network error', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockRejectedValue(new Error('Gateway timeout'));

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(false);
            expect(result.paymentStatus).toBe('UNKNOWN');
            expect(result.message).toContain('Gateway validation timed out');
        });

        it('should reject payment if amount tampering is detected', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '50.00', // Tampered amount!
                currency: 'BDT',
                val_id: 'VAL-123',
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(false);
            expect(result.paymentStatus).toBe('REVIEW_REQUIRED');
            expect(result.message).toContain('AMOUNT_MISMATCH');
        });

        it('should reject payment if transaction ID mismatch is detected', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-SPOOFED-999', // Spoofed tran_id!
                amount: '1000.00',
                currency: 'BDT',
                val_id: 'VAL-123',
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(false);
            expect(result.paymentStatus).toBe('REJECTED');
            expect(result.message).toContain('Transaction ID mismatch');
        });

        it('should reject payment if currency mismatch is detected', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '1000.00',
                currency: 'USD', // Tampered currency!
                val_id: 'VAL-123',
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(false);
            expect(result.paymentStatus).toBe('REVIEW_REQUIRED');
            expect(result.message).toContain('CURRENCY_MISMATCH');
        });

        it('should successfully confirm payment and update order to ORDER_PLACED', async () => {
            const mockPayment: any = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '1000.00',
                currency: 'BDT',
                val_id: 'VAL-123',
                bank_tran_id: 'BANK-999',
                card_type: 'BKASH-bKash',
                risk_level: '0',
            });

            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.PENDING,
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                return Promise.resolve(null);
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(true);
            expect(result.paymentStatus).toBe('PAID');
            expect(mockPayment.status).toBe(PaymentAttemptStatus.PAID);
            expect(mockPayment.paymentMethod).toBe(PaymentMethodType.BKASH);
            expect(mockPayment.bankTranId).toBe('BANK-999');
            expect(mockOrder.status).toBe(OrderStatus.ORDER_PLACED);
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.PAID);
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should flag for admin review if gateway reports risk_level = 1', async () => {
            const mockPayment: any = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '1000.00',
                currency: 'BDT',
                val_id: 'VAL-123',
                bank_tran_id: 'BANK-999',
                card_type: 'VISA-CityBank',
                risk_level: '1', // High risk flagged!
            });

            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.PENDING,
            };

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                return Promise.resolve(null);
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(true);
            expect(result.paymentStatus).toBe('REVIEW_REQUIRED');
            expect(mockPayment.status).toBe(PaymentAttemptStatus.PROCESSING);
            expect(mockPayment.needsAdminReview).toBe(true);
            expect(mockPayment.adminReviewReason).toBe('SUSPECTED_FRAUD_RISK_1');
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.REVIEW_REQUIRED);
        });

        it('should handle late payment recovery by re-reserving stock for CANCELLED order', async () => {
            const mockPayment = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '1000.00',
                currency: 'BDT',
                val_id: 'VAL-123',
                bank_tran_id: 'BANK-999',
                card_type: 'BKASH-bKash',
                risk_level: '0',
            });

            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                status: OrderStatus.CANCELLED, // Order was cancelled earlier!
                paymentStatus: PaymentStatus.PENDING,
            };

            const mockProduct = {
                id: 'prod-1',
                quantity: 10,
                sizeStock: { M: 5 },
            };

            const mockSummary = [
                {
                    productId: 'prod-1',
                    quantity: 2,
                    selectedSize: 'M',
                },
            ];

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                if (entityClass === Product) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockImplementation((entityClass: any) => {
                if (entityClass === OrderSummary) return Promise.resolve(mockSummary);
                return Promise.resolve([]);
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(true);
            expect(mockOrder.status).toBe(OrderStatus.ORDER_PLACED);
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.PAID);
            expect(mockQueryRunner.manager.update).toHaveBeenCalled();
        });

        it('should create pending refund if stock cannot be re-reserved for CANCELLED order', async () => {
            const mockPayment: any = {
                id: 'pay-1',
                tranId: 'SSLCZ-001',
                orderId: 'ord-1',
                status: PaymentAttemptStatus.PENDING,
                amount: '1000.00',
                currency: 'BDT',
            };

            const mockPaymentRepo = {
                findOne: jest.fn().mockResolvedValue(mockPayment),
            };
            mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

            mockSslcommerzService.validateTransaction.mockResolvedValue({
                status: 'VALID',
                tran_id: 'SSLCZ-001',
                amount: '1000.00',
                currency: 'BDT',
                val_id: 'VAL-123',
                bank_tran_id: 'BANK-999',
                card_type: 'BKASH-bKash',
                risk_level: '0',
            });

            const mockOrder = {
                id: 'ord-1',
                orderId: 'ORD-1001',
                status: OrderStatus.CANCELLED,
                paymentStatus: PaymentStatus.PENDING,
            };

            // Stock is completely exhausted!
            const mockProduct = {
                id: 'prod-1',
                quantity: 0,
            };

            const mockSummary = [
                {
                    productId: 'prod-1',
                    quantity: 2,
                },
            ];

            mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                if (entityClass === Orders) return Promise.resolve(mockOrder);
                if (entityClass === Payments) return Promise.resolve(mockPayment);
                if (entityClass === Product) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockImplementation((entityClass: any) => {
                if (entityClass === OrderSummary) return Promise.resolve(mockSummary);
                return Promise.resolve([]);
            });

            const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

            expect(result.success).toBe(true);
            expect(mockOrder.paymentStatus).toBe(PaymentStatus.REVIEW_REQUIRED);
            expect(mockPayment.needsAdminReview).toBe(true);
            expect(mockPayment.adminReviewReason).toBe('LATE_PAYMENT_STOCK_EXHAUSTED');
            expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentRefunds,
                expect.objectContaining({
                    reason: 'LATE_PAYMENT_STOCK_EXHAUSTED',
                    status: RefundStatus.PENDING,
                })
            );
        });

        describe('Conditional Update affected === 0 Deep Branching', () => {
            it('should return idempotent success when affected === 0 and freshPayment is already PAID with matching credentials', async () => {
                const mockPayment: any = {
                    id: 'pay-1',
                    tranId: 'SSLCZ-001',
                    valId: 'VAL-123',
                    orderId: 'ord-1',
                    status: PaymentAttemptStatus.PENDING,
                    amount: '1000.00',
                    currency: 'BDT',
                };

                const mockPaymentRepo = {
                    findOne: jest.fn().mockResolvedValue(mockPayment),
                };
                mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

                mockSslcommerzService.validateTransaction.mockResolvedValue({
                    status: 'VALID',
                    tran_id: 'SSLCZ-001',
                    amount: '1000.00',
                    currency: 'BDT',
                    val_id: 'VAL-123',
                });

                const mockOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1001',
                    status: OrderStatus.ORDER_PLACED,
                    paymentStatus: PaymentStatus.PAID,
                };

                // Concurrent request already changed status to PAID
                const freshPaymentAlreadyPaid = {
                    ...mockPayment,
                    status: PaymentAttemptStatus.PAID,
                    valId: 'VAL-123',
                };

                let paymentFindCallCount = 0;
                mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                    if (entityClass === Orders) return Promise.resolve(mockOrder);
                    if (entityClass === Payments) {
                        paymentFindCallCount++;
                        return Promise.resolve(paymentFindCallCount === 1 ? mockPayment : freshPaymentAlreadyPaid);
                    }
                    return Promise.resolve(null);
                });

                // Simulate conditional update returning affected === 0
                mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

                const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

                expect(result.success).toBe(true);
                expect(result.paymentStatus).toBe('PAID');
                expect(result.message).toContain('Already confirmed with matching gateway credentials');
                expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            });

            it('should reject when affected === 0 and freshPayment is already PAID but currency/val_id mismatches', async () => {
                const mockPayment: any = {
                    id: 'pay-1',
                    tranId: 'SSLCZ-001',
                    valId: 'VAL-DIFFERENT', // Different valId!
                    orderId: 'ord-1',
                    status: PaymentAttemptStatus.PENDING,
                    amount: '1000.00',
                    currency: 'BDT',
                };

                const mockPaymentRepo = {
                    findOne: jest.fn().mockResolvedValue(mockPayment),
                };
                mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

                mockSslcommerzService.validateTransaction.mockResolvedValue({
                    status: 'VALID',
                    tran_id: 'SSLCZ-001',
                    amount: '1000.00',
                    currency: 'BDT',
                    val_id: 'VAL-123',
                });

                const mockOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1001',
                    status: OrderStatus.ORDER_PLACED,
                    paymentStatus: PaymentStatus.PAID,
                };

                const freshPaymentAlreadyPaid = {
                    ...mockPayment,
                    status: PaymentAttemptStatus.PAID,
                    valId: 'VAL-DIFFERENT',
                };

                let paymentMismatchCallCount = 0;
                mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                    if (entityClass === Orders) return Promise.resolve(mockOrder);
                    if (entityClass === Payments) {
                        paymentMismatchCallCount++;
                        return Promise.resolve(paymentMismatchCallCount === 1 ? mockPayment : freshPaymentAlreadyPaid);
                    }
                    return Promise.resolve(null);
                });

                mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

                const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

                expect(result.success).toBe(false);
                expect(result.paymentStatus).toBe('REJECTED');
                expect(result.message).toContain('Credential mismatch');
                expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
            });

            it('should handle late payment recovery when affected === 0 and payment was EXPIRED', async () => {
                const mockPayment: any = {
                    id: 'pay-1',
                    tranId: 'SSLCZ-001',
                    orderId: 'ord-1',
                    status: PaymentAttemptStatus.PENDING,
                    amount: '1000.00',
                    currency: 'BDT',
                };

                const mockPaymentRepo = {
                    findOne: jest.fn().mockResolvedValue(mockPayment),
                };
                mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

                mockSslcommerzService.validateTransaction.mockResolvedValue({
                    status: 'VALID',
                    tran_id: 'SSLCZ-001',
                    amount: '1000.00',
                    currency: 'BDT',
                    val_id: 'VAL-123',
                });

                const mockOrder = {
                    id: 'ord-1',
                    orderId: 'ORD-1001',
                    status: OrderStatus.CANCELLED,
                    paymentStatus: PaymentStatus.UNPAID,
                };

                const freshPaymentExpired = {
                    ...mockPayment,
                    status: PaymentAttemptStatus.EXPIRED,
                };

                const mockProduct = { id: 'prod-1', quantity: 10, sizeStock: { M: 5 } };
                const mockSummary = [{ productId: 'prod-1', quantity: 1, selectedSize: 'M' }];

                mockQueryRunner.manager.findOne.mockImplementation((entityClass: any) => {
                    if (entityClass === Orders) return Promise.resolve(mockOrder);
                    if (entityClass === Payments) return Promise.resolve(freshPaymentExpired);
                    if (entityClass === Product) return Promise.resolve(mockProduct);
                    return Promise.resolve(null);
                });

                mockQueryRunner.manager.find.mockImplementation((entityClass: any) => {
                    if (entityClass === OrderSummary) return Promise.resolve(mockSummary);
                    return Promise.resolve([]);
                });

                mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

                const result = await service.confirmPayment('VAL-123', 'SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

                expect(result.success).toBe(true);
                expect(result.paymentStatus).toBe('PAID');
                expect(mockOrder.status).toBe(OrderStatus.ORDER_PLACED);
                expect(mockOrder.paymentStatus).toBe(PaymentStatus.PAID);
                expect(mockQueryRunner.manager.update).toHaveBeenCalled();
                expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            });
        });

        describe('State Machine Invariants in Failed & Cancelled Handlers', () => {
            it('handleFailedAttempt should NOT transition payment to FAILED if already PAID', async () => {
                const mockPayment = {
                    id: 'pay-1',
                    tranId: 'SSLCZ-001',
                    status: PaymentAttemptStatus.PAID,
                };

                const mockPaymentRepo = {
                    findOne: jest.fn().mockResolvedValue(mockPayment),
                    save: jest.fn(),
                };
                mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

                await service.handleFailedAttempt(mockPayment, { status: 'FAILED' }, PaymentEventSource.BROWSER_CALLBACK);

                expect(mockPaymentRepo.save).not.toHaveBeenCalled();
            });

            it('handleCancelledAttempt should NOT transition payment to CANCELLED if already PAID', async () => {
                const mockPayment = {
                    id: 'pay-1',
                    tranId: 'SSLCZ-001',
                    status: PaymentAttemptStatus.PAID,
                };

                const mockPaymentRepo = {
                    findOne: jest.fn().mockResolvedValue(mockPayment),
                    save: jest.fn(),
                };
                mockDataSource.getRepository.mockReturnValue(mockPaymentRepo);

                await service.handleCancelledAttempt('SSLCZ-001', PaymentEventSource.BROWSER_CALLBACK);

                expect(mockPaymentRepo.save).not.toHaveBeenCalled();
            });
        });
    });
});
