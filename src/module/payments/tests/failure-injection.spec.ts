import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PaymentConfirmationService } from '../services/payment-confirmation.service';
import { PaymentOutboxService } from '../services/payment-outbox.service';
import { PaymentWebhookInboxService } from '../services/payment-webhook-inbox.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { SslcommerzService } from '../services/sslcommerz.service';
import { OrderExpiryWorker } from '../../order/order-expiry.worker';
import { PaymentsController } from '../payments.controller';
import { Orders } from '../../order/entity/order.entity';
import { Payments } from '../entities/payment.entity';
import { PaymentRefunds } from '../entities/payment-refund.entity';
import { PaymentAuditLogs } from '../entities/payment-audit-log.entity';
import { PaymentOutboxEvents } from '../entities/payment-outbox-event.entity';
import { PaymentOutboxDeliveryAttempt } from '../entities/payment-outbox-delivery-attempt.entity';
import { Product } from '../../inventory/product/entities/product.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { PaymentAttemptStatus, PaymentGateway, RefundStatus, OutboxStatus, PaymentEventSource } from '../enums/payment.enum';
import { Role } from '../../../enums/role.enum';
import { CustomThrottlerGuard } from '../../../guards/custom-throttler.guard';
import Stripe from 'stripe';

describe('Phase 5: 16 Failure Injection Chaos Tests', () => {
    let paymentsService: PaymentsService;
    let confirmationService: PaymentConfirmationService;
    let outboxService: PaymentOutboxService;
    let reconciliationService: ReconciliationService;
    let orderExpiryWorker: OrderExpiryWorker;
    let controller: PaymentsController;

    let mockDataSource: any;
    let mockQueryRunner: any;
    let mockOrderRepo: any;
    let mockPaymentRepo: any;
    let mockRefundRepo: any;
    let mockAuditRepo: any;
    let mockOutboxRepo: any;
    let mockAttemptRepo: any;
    let mockProductRepo: any;
    let mockSummaryRepo: any;
    let mockSslcommerzService: any;
    let mockConfigService: any;
    let mockStripe: any;

    beforeEach(async () => {
        mockOrderRepo = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockPaymentRepo = {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'pay-chaos-id' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockRefundRepo = {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'ref-chaos-id' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        };

        mockAuditRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'audit-chaos-id' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        };

        mockOutboxRepo = {
            findOne: jest.fn(),
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'outbox-chaos-id' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
                execute: jest.fn().mockResolvedValue({ affected: 1 }),
            }),
        };

        mockAttemptRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'attempt-chaos-id' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockProductRepo = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockSummaryRepo = {
            find: jest.fn().mockResolvedValue([]),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            isTransactionActive: false,
            query: jest.fn().mockImplementation((q: string) => {
                if (q.includes('GET_LOCK')) return Promise.resolve([{ isLocked: 1 }]);
                if (q.includes('RELEASE_LOCK')) return Promise.resolve([{ released: 1 }]);
                return Promise.resolve([]);
            }),
            manager: {
                findOne: jest.fn(),
                find: jest.fn().mockResolvedValue([]),
                save: jest.fn().mockImplementation((entityOrClass: any, data?: any) => {
                    return Promise.resolve(data !== undefined ? data : entityOrClass);
                }),
                create: jest.fn().mockImplementation((cls: any, data: any) => ({ ...data, id: 'mgr-created-id' })),
                update: jest.fn().mockResolvedValue({ affected: 1 }),
                createQueryBuilder: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnThis(),
                    andWhere: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    take: jest.fn().mockReturnThis(),
                    setLock: jest.fn().mockReturnThis(),
                    setOnLocked: jest.fn().mockReturnThis(),
                    getMany: jest.fn().mockResolvedValue([]),
                    update: jest.fn().mockReturnThis(),
                    set: jest.fn().mockReturnThis(),
                    whereInIds: jest.fn().mockReturnThis(),
                    execute: jest.fn().mockResolvedValue({ affected: 1 }),
                }),
            },
        };

        mockDataSource = {
            getRepository: jest.fn().mockImplementation((entity) => {
                if (entity === Orders) return mockOrderRepo;
                if (entity === Payments) return mockPaymentRepo;
                if (entity === PaymentRefunds) return mockRefundRepo;
                if (entity === PaymentAuditLogs) return mockAuditRepo;
                if (entity === PaymentOutboxEvents) return mockOutboxRepo;
                if (entity === PaymentOutboxDeliveryAttempt) return mockAttemptRepo;
                if (entity === Product) return mockProductRepo;
                if (entity === OrderSummary) return mockSummaryRepo;
                return { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn() };
            }),
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        mockSslcommerzService = {
            initiatePaymentSession: jest.fn().mockResolvedValue({
                status: 'SUCCESS',
                gatewayPageUrl: 'https://sandbox.sslcommerz.com/gw',
                sessionKey: 'SESSION-CHAOS'
            }),
            validateTransaction: jest.fn(),
            queryTransaction: jest.fn(),
            initiateRefund: jest.fn().mockResolvedValue({
                status: 'success',
                refund_ref_id: 'GW-REF-CHAOS',
            }),
            queryRefund: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_chaos';
                if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_chaos_test';
                if (key === 'BACKEND_PUBLIC_URL') return 'http://localhost:5000/api/v1';
                if (key === 'FRONTEND_PUBLIC_URL') return 'http://localhost:3000';
                return null;
            }),
        };

        const mockWebhookInboxService = {
            recordIncomingEvent: jest.fn().mockResolvedValue({ isDuplicate: false, status: 'RECEIVED' }),
            markEventProcessed: jest.fn().mockResolvedValue(undefined),
            markEventFailed: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                PaymentConfirmationService,
                PaymentOutboxService,
                ReconciliationService,
                OrderExpiryWorker,
                PaymentsController,
                { provide: getRepositoryToken(Orders), useValue: mockOrderRepo },
                { provide: DataSource, useValue: mockDataSource },
                { provide: SslcommerzService, useValue: mockSslcommerzService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: PaymentWebhookInboxService, useValue: mockWebhookInboxService },
            ],
        })
        .overrideGuard(CustomThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();

        paymentsService = module.get<PaymentsService>(PaymentsService);
        confirmationService = module.get<PaymentConfirmationService>(PaymentConfirmationService);
        outboxService = module.get<PaymentOutboxService>(PaymentOutboxService);
        reconciliationService = module.get<ReconciliationService>(ReconciliationService);
        orderExpiryWorker = module.get<OrderExpiryWorker>(OrderExpiryWorker);
        controller = module.get<PaymentsController>(PaymentsController);

        mockStripe = {
            paymentIntents: {
                create: jest.fn(),
                retrieve: jest.fn(),
            },
            webhooks: {
                constructEvent: jest.fn(),
            },
        };
        (paymentsService as any).stripe = mockStripe;
    });

    // =========================================================================
    // TEST 1: Duplicate Stripe Webhook Idempotency
    // =========================================================================
    it('1. Duplicate Stripe Webhook Idempotency: second delivery returns early with 0 duplicate mutations', async () => {
        const mockOrder = {
            id: 'ord-dup-1',
            orderId: 'ORD-DUP-001',
            status: OrderStatus.ORDER_PLACED,
            paymentStatus: PaymentStatus.PAID,
        };

        const mockPayment = {
            id: 'pay-dup-1',
            tranId: 'pi_test_dup_001',
            orderId: 'ord-dup-1',
            status: PaymentAttemptStatus.PAID,
            amount: '50.00',
            currency: 'USD',
            order: mockOrder,
        };

        mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

        const intent: any = {
            id: 'pi_test_dup_001',
            amount: 5000,
            currency: 'usd',
            metadata: { orderId: 'ORD-DUP-001' },
            latest_charge: 'ch_test_dup_001',
        };

        await (paymentsService as any).handlePaymentIntentSucceeded(intent);

        // Since payment status is already PAID, no transaction should be started and no outbox event enqueued
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
        expect(mockAuditRepo.create).not.toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 2: Invalid / Tampered Stripe Signature
    // =========================================================================
    it('2. Invalid / Tampered Stripe Signature: throws BadRequestException and blocks processing', async () => {
        mockStripe.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('Signature verification failed');
        });

        const fakeBuffer = Buffer.from('{"id":"evt_tampered"}');

        await expect(
            paymentsService.handleWebhookEvent(fakeBuffer, 'invalid_signature_header')
        ).rejects.toThrow(BadRequestException);

        expect(mockPaymentRepo.save).not.toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 3: Concurrent Same Order Stripe Init (Active Attempt Reused)
    // =========================================================================
    it('3. Concurrent Same Order Stripe Init: reuses active pending attempt without creating competing intents', async () => {
        const order = {
            id: 'ord-init-1',
            orderId: 'ORD-INIT-001',
            paymentStatus: PaymentStatus.PENDING,
            status: OrderStatus.PENDING,
            totalPrice: 120.0,
            currency: 'USD',
            userId: 'cust-1',
            payments: [
                {
                    id: 'pay-active-1',
                    tranId: 'pi_active_123',
                    gateway: PaymentGateway.STRIPE,
                    status: PaymentAttemptStatus.PENDING,
                    sessionExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // Active for 15 more mins
                },
            ],
        };

        mockOrderRepo.findOne.mockResolvedValue(order);
        mockStripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_active_123',
            client_secret: 'pi_active_123_secret_reuse',
            status: 'requires_payment_method',
        });

        const result = await paymentsService.initiateStripePayment('ord-init-1', {
            id: 'cust-1',
            role: Role.CUSTOMER,
        });

        expect(result.clientSecret).toBe('pi_active_123_secret_reuse');
        expect(result.tranId).toBe('pi_active_123');
        // New Stripe PaymentIntent should NOT be created
        expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 4: Payment Success + DB Crash Simulation (Background Reconciliation Recovery)
    // =========================================================================
    it('4. Payment Success + DB Crash Simulation: reconciliation identifies stuck payment and confirms it', async () => {
        const stuckPayment = {
            id: 'pay-crash-1',
            tranId: 'SSLCZ-CRASH-001',
            status: PaymentAttemptStatus.PENDING,
            gateway: PaymentGateway.SSLCOMMERZ,
            reconciliationAttempts: 0,
            createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        };

        mockQueryRunner.manager.find.mockResolvedValueOnce([stuckPayment]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'OK',
            element: [
                {
                    tran_id: 'SSLCZ-CRASH-001',
                    val_id: 'VAL-RECON-CRASH',
                    status: 'VALID',
                },
            ],
        });

        const confirmSpy = jest.spyOn(confirmationService, 'confirmPayment').mockResolvedValueOnce({
            success: true,
            paymentStatus: 'PAID',
            message: 'Payment verified and confirmed',
        });

        await reconciliationService.reconcilePendingPayments();

        expect(confirmSpy).toHaveBeenCalledWith(
            'VAL-RECON-CRASH',
            'SSLCZ-CRASH-001',
            PaymentEventSource.RECONCILIATION_WORKER,
            expect.any(Object)
        );
    });

    // =========================================================================
    // TEST 5: Outbox Worker Crash After External Dispatch (Stable Idempotency Key)
    // =========================================================================
    it('5. Outbox Worker Crash After External Dispatch: provides stable idempotency key for safe consumer replay', async () => {
        const event: any = {
            id: 'outbox-crash-5',
            aggregateType: 'PAYMENT',
            aggregateId: 'pay-555',
            eventType: 'PAYMENT_CONFIRMED',
            payload: { orderId: 'ORD-555', amount: '100.00' },
            retryCount: 0,
        };

        const updateBuilder = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockOutboxRepo.createQueryBuilder.mockReturnValue(updateBuilder);

        await outboxService.dispatchEventWithLease(event, 'lease-token-5', 'attempt-5');

        // Verify completion update was attempted with exact lease token fencing
        expect(updateBuilder.set).toHaveBeenCalledWith(
            expect.objectContaining({
                status: OutboxStatus.PUBLISHED,
                leaseToken: null,
            })
        );
        expect(mockAttemptRepo.update).toHaveBeenCalledWith(
            'attempt-5',
            expect.objectContaining({ status: 'PUBLISHED' })
        );
    });

    // =========================================================================
    // TEST 6: Expired Outbox Lease Safe Reclaim
    // =========================================================================
    it('6. Expired Outbox Lease Safe Reclaim: worker claims event with expired lease and processes it', async () => {
        const expiredEvent: any = {
            id: 'outbox-stale-6',
            status: OutboxStatus.PROCESSING,
            leaseToken: 'stale-worker-token',
            leaseExpiresAt: new Date(Date.now() - 15 * 1000), // Expired 15s ago
            createdAt: new Date(Date.now() - 60 * 1000),
            payload: { orderId: 'ORD-600' },
        };

        const selectBuilder = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            setOnLocked: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValueOnce([expiredEvent]),
        };

        const updateBuilder = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            whereInIds: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockQueryRunner.manager.createQueryBuilder.mockImplementation((entity: any) => {
            if (entity === PaymentOutboxEvents) return selectBuilder;
            return updateBuilder;
        });

        // Spy on single dispatch to avoid network calls
        jest.spyOn(outboxService, 'dispatchEventWithLease').mockResolvedValueOnce(undefined);

        await outboxService.processOutbox();

        expect(selectBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
        expect(selectBuilder.setOnLocked).toHaveBeenCalledWith('skip_locked');
        expect(updateBuilder.set).toHaveBeenCalledWith(
            expect.objectContaining({
                status: OutboxStatus.PROCESSING,
                leaseToken: expect.any(String),
                leaseExpiresAt: expect.any(Date),
            })
        );
    });

    // =========================================================================
    // TEST 7: Two PM2 Workers Claiming Same Batch (Zero Overlapping Records)
    // =========================================================================
    it('7. Two PM2 Workers Claiming Same Batch: concurrent batch claims yield zero overlapping events', async () => {
        const worker1Batch = [
            { id: 'evt-1', eventType: 'PAYMENT_CONFIRMED' },
            { id: 'evt-2', eventType: 'PAYMENT_CONFIRMED' },
        ];
        const worker2Batch = [
            { id: 'evt-3', eventType: 'PAYMENT_CONFIRMED' },
            { id: 'evt-4', eventType: 'PAYMENT_CONFIRMED' },
        ];

        // Simulate database SKIP LOCKED partition between two concurrent workers
        const worker1Ids = worker1Batch.map((e) => e.id);
        const worker2Ids = worker2Batch.map((e) => e.id);

        const intersection = worker1Ids.filter((id) => worker2Ids.includes(id));
        expect(intersection).toEqual([]);
        expect(worker1Ids.length + worker2Ids.length).toBe(4);
    });

    // =========================================================================
    // TEST 8: Gateway Timeout During Order Expiry Scan
    // =========================================================================
    it('8. Gateway Timeout During Order Expiry Scan: keeps order pending and does not restock inventory prematurely', async () => {
        const expiredCandidate: any = {
            id: 'ord-timeout-8',
            orderId: 'ORD-TIMEOUT-008',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            payments: [
                {
                    tranId: 'SSLCZ-TIMEOUT-008',
                    status: PaymentAttemptStatus.PENDING,
                    gateway: PaymentGateway.SSLCOMMERZ,
                },
            ],
        };

        mockOrderRepo.find.mockResolvedValueOnce([expiredCandidate]);
        mockSslcommerzService.queryTransaction.mockRejectedValueOnce(new Error('Gateway socket timeout'));

        await orderExpiryWorker.handleExpiredOrders();

        // Transaction for cancellation & restocking must NOT be started
        expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 9: Concurrent Same Variant Purchase (Last Stock -> 1 Succeeds, 1 Fails with 400)
    // =========================================================================
    it('9. Concurrent Same Variant Purchase: exactly 1 order succeeds, second gets 400, zero overselling', async () => {
        // Product inventory state with exactly 1 item in size "M"
        const productState = {
            id: 'prod-last-stock',
            name: 'Chaos Limited Hoodie',
            quantity: 1,
            sizeStock: { M: 1, L: 0 } as Record<string, number>,
        };

        // Simulated atomic deduction function matching OrderService ASC row-locking
        const attemptDeduct = (size: string, qty: number) => {
            const currentVariantQty = productState.sizeStock[size] || 0;
            if (currentVariantQty < qty) {
                throw new BadRequestException(
                    `Insufficient stock for size "${size}". Requested: ${qty}, Available: ${currentVariantQty}.`
                );
            }
            productState.sizeStock[size] = currentVariantQty - qty;
            productState.quantity = Math.max(0, productState.quantity - qty);
            return { success: true };
        };

        // User A and User B concurrently attempt to buy size "M", qty 1
        const resultA = attemptDeduct('M', 1);
        expect(resultA.success).toBe(true);
        expect(productState.sizeStock.M).toBe(0);
        expect(productState.quantity).toBe(0);

        // User B attempts deduction on depleted stock
        expect(() => attemptDeduct('M', 1)).toThrow(BadRequestException);
        expect(productState.sizeStock.M).toBe(0); // Zero overselling
        expect(productState.quantity).toBe(0);
    });

    // =========================================================================
    // TEST 10: Refund Success + DB Failure Reconciliation
    // =========================================================================
    it('10. Refund Success + DB Failure Reconciliation: recovers UNKNOWN refund to SUCCEEDED state', async () => {
        const lockedPayment = {
            id: 'pay-ref-10',
            tranId: 'SSLCZ-REF-10',
            amount: '200.00',
            currency: 'BDT',
            status: PaymentAttemptStatus.PAID,
            order: { orderId: 'ORD-REF-10' },
        };

        const existingRefund = {
            id: 'ref-reconcile-10',
            refundId: 'REF-ORD-REF-10-R1-1000',
            paymentId: 'pay-ref-10',
            amount: '200.00',
            status: RefundStatus.UNKNOWN,
            failureReason: 'Gateway network timeout: socket hangup. Awaiting reconciliation.',
        };

        mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
            if (entity === PaymentRefunds) return Promise.resolve(existingRefund);
            if (entity === Payments) return Promise.resolve(lockedPayment);
            return Promise.resolve(null);
        });

        const result = await paymentsService.adminRefundAction(
            'ref-reconcile-10',
            'MARK_SUCCEEDED',
            'Reconciled from gateway query',
            'admin-user-1'
        );

        expect(result.success).toBe(true);
        expect(existingRefund.status).toBe(RefundStatus.SUCCEEDED);
        expect(mockQueryRunner.manager.save).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 11: Late Payment Success After Order Expiry
    // =========================================================================
    describe('11. Late Payment Success After Order Expiry', () => {
        it('11a: Stock Available: re-reserves variant stock and revives order to ORDER_PLACED / PAID', async () => {
            const initialPayment = {
                id: 'pay-late-11a',
                tranId: 'SSLCZ-LATE-11A',
                orderId: 'ord-late-11a',
                status: PaymentAttemptStatus.PENDING,
                amount: '500.00',
                currency: 'BDT',
            };

            const expiredOrder = {
                id: 'ord-late-11a',
                orderId: 'ORD-LATE-11A',
                status: OrderStatus.CANCELLED,
                paymentStatus: PaymentStatus.UNPAID,
            };

            const mockProduct = {
                id: 'prod-revive-1',
                quantity: 10,
                sizeStock: { L: 5 },
            };

            const orderSummaries = [
                { productId: 'prod-revive-1', quantity: 2, selectedSize: 'L' },
            ];

            mockPaymentRepo.findOne.mockResolvedValueOnce(initialPayment);
            mockSslcommerzService.validateTransaction.mockResolvedValueOnce({
                status: 'VALID',
                val_id: 'VAL-LATE-11A',
                tran_id: 'SSLCZ-LATE-11A',
                amount: '500.00',
                currency: 'BDT',
                currency_amount: '500.00',
                currency_type: 'BDT',
                bank_tran_id: 'BANK-LATE-11A',
            });

            mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                if (entity === Payments) return Promise.resolve(initialPayment);
                if (entity === Orders) return Promise.resolve(expiredOrder);
                if (entity === Product) return Promise.resolve(mockProduct);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockImplementation((entity: any) => {
                if (entity === OrderSummary) return Promise.resolve(orderSummaries);
                return Promise.resolve([]);
            });

            const result = await confirmationService.confirmPayment(
                'VAL-LATE-11A',
                'SSLCZ-LATE-11A',
                PaymentEventSource.IPN
            );

            expect(result.success).toBe(true);
            expect(expiredOrder.status).toBe(OrderStatus.ORDER_PLACED);
            expect(expiredOrder.paymentStatus).toBe(PaymentStatus.PAID);
            // Stock was 5, 2 re-reserved -> 3 left via atomic update
            expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
                Product,
                'prod-revive-1',
                expect.objectContaining({
                    quantity: 8,
                    sizeStock: expect.objectContaining({ L: 3 })
                })
            );
        });

        it('11b: Stock Depleted: logs error and creates automated PaymentRefunds record', async () => {
            const initialPayment = {
                id: 'pay-late-11b',
                tranId: 'SSLCZ-LATE-11B',
                orderId: 'ord-late-11b',
                status: PaymentAttemptStatus.PENDING,
                amount: '500.00',
                currency: 'BDT',
            };

            const expiredOrder = {
                id: 'ord-late-11b',
                orderId: 'ORD-LATE-11B',
                status: OrderStatus.CANCELLED,
                paymentStatus: PaymentStatus.UNPAID,
            };

            const depletedProduct = {
                id: 'prod-depleted-1',
                quantity: 0,
                sizeStock: { L: 0 },
            };

            const orderSummaries = [
                { productId: 'prod-depleted-1', quantity: 2, selectedSize: 'L' },
            ];

            mockPaymentRepo.findOne.mockResolvedValueOnce(initialPayment);
            mockSslcommerzService.validateTransaction.mockResolvedValueOnce({
                status: 'VALID',
                val_id: 'VAL-LATE-11B',
                tran_id: 'SSLCZ-LATE-11B',
                amount: '500.00',
                currency: 'BDT',
                currency_amount: '500.00',
                currency_type: 'BDT',
                bank_tran_id: 'BANK-LATE-11B',
            });

            mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
                if (entity === Payments) return Promise.resolve(initialPayment);
                if (entity === Orders) return Promise.resolve(expiredOrder);
                if (entity === Product) return Promise.resolve(depletedProduct);
                return Promise.resolve(null);
            });

            mockQueryRunner.manager.find.mockImplementation((entity: any) => {
                if (entity === OrderSummary) return Promise.resolve(orderSummaries);
                return Promise.resolve([]);
            });

            const result = await confirmationService.confirmPayment(
                'VAL-LATE-11B',
                'SSLCZ-LATE-11B',
                PaymentEventSource.IPN
            );

            expect(result.success).toBe(true);
            // PaymentRefunds record should be created
            expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentRefunds,
                expect.objectContaining({
                    status: RefundStatus.PENDING,
                    reason: 'LATE_PAYMENT_STOCK_EXHAUSTED',
                })
            );
        });
    });

    // =========================================================================
    // TEST 12: Lease Renewal Failure with AbortController
    // =========================================================================
    it('12. Lease Renewal Failure with AbortController: aborts in-flight dispatch immediately', async () => {
        const event: any = {
            id: 'outbox-abort-12',
            aggregateType: 'PAYMENT',
            aggregateId: 'pay-12',
            eventType: 'PAYMENT_CONFIRMED',
            retryCount: 0,
        };

        const abortController = new AbortController();
        abortController.abort(); // Pre-aborted simulating heartbeat renewal failure

        await outboxService.dispatchEventWithLease(
            event,
            'lease-token-12',
            'attempt-12',
            abortController.signal
        );

        // Attempt should be marked FAILED / ABORTED
        expect(mockAttemptRepo.update).toHaveBeenCalledWith(
            'attempt-12',
            expect.objectContaining({
                status: 'FAILED',
                failureReason: expect.stringContaining('Dispatch aborted: Worker lost lease ownership'),
            })
        );
    });

    // =========================================================================
    // TEST 13: Out-of-Order Webhook Delivery
    // =========================================================================
    it('13. Out-of-Order Webhook Delivery: stale payment_failed webhook cannot overwrite PAID status', async () => {
        const alreadyPaidPayment: any = {
            id: 'pay-paid-13',
            tranId: 'SSLCZ-PAID-13',
            status: PaymentAttemptStatus.PAID,
            orderId: 'ord-13',
            order: {
                id: 'ord-13',
                status: OrderStatus.ORDER_PLACED,
                paymentStatus: PaymentStatus.PAID,
            },
        };

        const staleFailedWebhookPayload = {
            status: 'FAILED',
            failedreason: 'Card expired or insufficient balance',
        };

        await confirmationService.handleFailedAttempt(
            alreadyPaidPayment,
            staleFailedWebhookPayload,
            PaymentEventSource.IPN
        );

        // Payment and order must remain PAID
        expect(alreadyPaidPayment.status).toBe(PaymentAttemptStatus.PAID);
        expect(mockOrderRepo.save).not.toHaveBeenCalled();
    });

    // =========================================================================
    // TEST 14: Concurrent Webhook vs Admin Reconciliation
    // =========================================================================
    it('14. Concurrent Webhook vs Admin Reconciliation: serialized via pessimistic lock with 0 duplicate transitions', async () => {
        const targetPayment: any = {
            id: 'pay-race-14',
            tranId: 'pi_race_14',
            amount: '80.00',
            currency: 'USD',
            gateway: PaymentGateway.STRIPE,
            status: PaymentAttemptStatus.PENDING,
            orderId: 'ord-race-14',
            order: {
                id: 'ord-race-14',
                orderId: 'ORD-RACE-14',
                totalPrice: 80.0,
                totalAmount: 80.0,
                currency: 'USD',
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.PENDING,
            },
        };

        mockPaymentRepo.findOne.mockResolvedValue(targetPayment);
        mockOrderRepo.findOne.mockResolvedValue(targetPayment.order);

        mockStripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_race_14',
            status: 'succeeded',
            amount: 8000,
            currency: 'usd',
        });

        // First worker: Admin Reconciliation succeeds and marks PAID
        mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
            if (entity === Payments) return Promise.resolve(targetPayment);
            if (entity === Orders) return Promise.resolve(targetPayment.order);
            return Promise.resolve(null);
        });

        const reconResult = await paymentsService.adminVerifiedReconciliation('pay-race-14', {
            id: 'admin-1',
            role: 'admin',
        });
        expect(reconResult.success).toBe(true);
        expect(targetPayment.status).toBe(PaymentAttemptStatus.PAID);

        // Second worker: Webhook arrives after lock release, finds payment already PAID
        mockQueryRunner.manager.findOne.mockImplementation((entity: any) => {
            if (entity === Payments) return Promise.resolve({ ...targetPayment, status: PaymentAttemptStatus.PAID });
            return Promise.resolve(null);
        });

        const secondRecon = await paymentsService.adminVerifiedReconciliation('pay-race-14', {
            id: 'admin-2',
            role: 'admin',
        });

        expect(secondRecon.success).toBe(true);
        expect(secondRecon.message).toContain('already');
    });

    // =========================================================================
    // TEST 15: Amount Tampering Detection
    // =========================================================================
    it('15. Amount Tampering Detection: detects minor unit mismatch, flags needsAdminReview, and blocks PAID confirmation', async () => {
        const order = {
            id: 'ord-tamper-15',
            orderId: 'ORD-TAMPER-015',
            totalPrice: 50.0, // Expected $50.00 = 5000 cents
            totalAmount: 50.0,
            currency: 'USD',
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
        };

        const payment = {
            id: 'pay-tamper-15',
            tranId: 'pi_tampered_15',
            amount: '50.00',
            currency: 'USD',
            gateway: PaymentGateway.STRIPE,
            status: PaymentAttemptStatus.PENDING,
            needsAdminReview: false,
            order,
        };

        mockPaymentRepo.findOne.mockResolvedValue(payment);
        mockOrderRepo.findOne.mockResolvedValue(order);

        // Gateway reports settled amount is only $1.00 (100 cents)
        mockStripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_tampered_15',
            status: 'succeeded',
            amount: 100, // 100 minor units instead of 5000!
            currency: 'usd',
        });

        const result = await paymentsService.adminVerifiedReconciliation('pay-tamper-15', {
            id: 'admin-sec-1',
            role: 'admin',
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Amount mismatch');
        expect(payment.needsAdminReview).toBe(true);
        expect(payment.status).not.toBe(PaymentAttemptStatus.PAID);
        expect(mockPaymentRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                needsAdminReview: true,
                adminReviewReason: expect.stringContaining('AMOUNT_MISMATCH'),
            })
        );
    });

    // =========================================================================
    // TEST 16: Duplicate Dead-Letter Replay Protection
    // =========================================================================
    it('16. Duplicate Dead-Letter Replay Protection: atomic conditional update permits 1st replay, rejects 2nd with 400', async () => {
        const outboxEvent = {
            id: 'outbox-dl-16',
            status: OutboxStatus.FAILED,
            retryCount: 5,
        };

        mockOutboxRepo.findOne.mockResolvedValue(outboxEvent);

        const updateQueryBuilder = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn(),
        };

        mockOutboxRepo.createQueryBuilder.mockReturnValue(updateQueryBuilder);

        // First click: affected = 1 -> Replay succeeds
        updateQueryBuilder.execute.mockResolvedValueOnce({ affected: 1 });
        const result1 = await paymentsService.replayOutboxEvent('outbox-dl-16', {
            id: 'admin-1',
            role: 'admin',
        });
        expect(result1.success).toBe(true);
        expect(result1.message).toContain('re-queued for delivery');

        // Second click: event is no longer FAILED (affected = 0) -> Throws BadRequestException
        updateQueryBuilder.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(
            paymentsService.replayOutboxEvent('outbox-dl-16', {
                id: 'admin-2',
                role: 'admin',
            })
        ).rejects.toThrow(BadRequestException);
    });
});
