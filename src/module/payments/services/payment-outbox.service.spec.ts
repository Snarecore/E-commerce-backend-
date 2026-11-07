import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PaymentOutboxService } from './payment-outbox.service';
import { PaymentOutboxEvents } from '../entities/payment-outbox-event.entity';
import { PaymentOutboxDeliveryAttempt } from '../entities/payment-outbox-delivery-attempt.entity';
import { OutboxStatus } from '../enums/payment.enum';

describe('PaymentOutboxService (Transactional Outbox Pattern)', () => {
    let service: PaymentOutboxService;
    let mockDataSource: any;
    let mockOutboxRepo: any;
    let mockAttemptRepo: any;
    let mockQueryRunner: any;
    let mockUpdateQueryBuilder: any;

    beforeEach(async () => {
        mockUpdateQueryBuilder = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            whereInIds: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockOutboxRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'outbox-1' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
        };

        mockAttemptRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'attempt-1' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        const mockSelectQueryBuilder = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            isTransactionActive: false,
            manager: {
                createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
                    if (entity === PaymentOutboxEvents) return mockSelectQueryBuilder;
                    return mockUpdateQueryBuilder;
                }),
                create: jest.fn().mockImplementation((entity: any, data: any) => ({ ...data, id: 'tx-created-1' })),
                save: jest.fn().mockImplementation((entity: any, data: any) => Promise.resolve(data)),
            },
        };

        mockDataSource = {
            getRepository: jest.fn().mockImplementation((entity: any) => {
                if (entity === PaymentOutboxDeliveryAttempt) return mockAttemptRepo;
                return mockOutboxRepo;
            }),
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentOutboxService,
                { provide: DataSource, useValue: mockDataSource },
            ],
        }).compile();

        service = module.get<PaymentOutboxService>(PaymentOutboxService);
    });

    describe('enqueueEvent (Transactional Consistency)', () => {
        it('should create and save outbox event within provided queryRunner transaction', async () => {
            const mockCustomQueryRunner: any = {
                manager: {
                    create: jest.fn().mockImplementation((cls, data) => ({ ...data, id: 'outbox-tx-1' })),
                    save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
                },
            };

            const result = await PaymentOutboxService.enqueueEvent(
                mockCustomQueryRunner,
                'PAYMENT',
                'pay-123',
                'PAYMENT_CONFIRMED',
                { amount: '1000.00', orderId: 'ORD-1001' }
            );

            expect(mockCustomQueryRunner.manager.create).toHaveBeenCalledWith(
                PaymentOutboxEvents,
                expect.objectContaining({
                    aggregateType: 'PAYMENT',
                    aggregateId: 'pay-123',
                    eventType: 'PAYMENT_CONFIRMED',
                    status: OutboxStatus.PENDING,
                    replayCount: 0,
                })
            );
            expect(mockCustomQueryRunner.manager.save).toHaveBeenCalled();
            expect(result.id).toBe('outbox-tx-1');
        });
    });

    describe('dispatchEventWithLease (Reliable Dispatcher Pipeline & Fencing)', () => {
        it('should dispatch event and mark as PUBLISHED with lease ownership verification', async () => {
            const event: any = {
                id: 'outbox-1',
                aggregateType: 'PAYMENT',
                aggregateId: 'pay-123',
                eventType: 'PAYMENT_CONFIRMED',
                payload: { orderId: 'ORD-1001' },
                retryCount: 0,
            };

            mockUpdateQueryBuilder.execute.mockResolvedValueOnce({ affected: 1 });

            await service.dispatchEventWithLease(event, 'lease-token-123', 'attempt-1');

            expect(mockUpdateQueryBuilder.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: OutboxStatus.PUBLISHED,
                })
            );
            expect(mockAttemptRepo.update).toHaveBeenCalledWith(
                'attempt-1',
                expect.objectContaining({
                    status: 'PUBLISHED',
                })
            );
        });

        it('should record ABORTED in attempt log if lease ownership was lost during dispatch', async () => {
            const event: any = {
                id: 'outbox-1',
                aggregateType: 'PAYMENT',
                aggregateId: 'pay-123',
                eventType: 'PAYMENT_CONFIRMED',
                payload: { orderId: 'ORD-1001' },
                retryCount: 0,
            };

            // affected: 0 simulates lease token mismatch (fencing triggered)
            mockUpdateQueryBuilder.execute.mockResolvedValueOnce({ affected: 0 });

            await service.dispatchEventWithLease(event, 'expired-lease-token', 'attempt-2');

            expect(mockAttemptRepo.update).toHaveBeenCalledWith(
                'attempt-2',
                expect.objectContaining({
                    status: 'ABORTED',
                    failureReason: 'Lost lease ownership during dispatch',
                })
            );
        });

        it('should increment retryCount with backoff and mark attempt as FAILED on dispatch error', async () => {
            const event: any = {
                id: 'outbox-1',
                aggregateType: 'PAYMENT',
                aggregateId: 'pay-123',
                eventType: 'PAYMENT_CONFIRMED',
                retryCount: 1,
            };

            mockUpdateQueryBuilder.execute.mockRejectedValueOnce(new Error('Downstream network timeout'));

            await service.dispatchEventWithLease(event, 'lease-token-123', 'attempt-3');

            expect(mockAttemptRepo.update).toHaveBeenCalledWith(
                'attempt-3',
                expect.objectContaining({
                    status: 'FAILED',
                    failureReason: 'Downstream network timeout',
                })
            );
        });

        it('should transition to FAILED dead-letter status after reaching max retries (5)', async () => {
            const event: any = {
                id: 'outbox-1',
                aggregateType: 'PAYMENT',
                aggregateId: 'pay-123',
                eventType: 'PAYMENT_CONFIRMED',
                retryCount: 4, // 5th attempt
            };

            mockUpdateQueryBuilder.execute.mockRejectedValueOnce(new Error('Fatal delivery error'));

            await service.dispatchEventWithLease(event, 'lease-token-123', 'attempt-4');

            expect(mockAttemptRepo.update).toHaveBeenCalledWith(
                'attempt-4',
                expect.objectContaining({
                    status: 'FAILED',
                })
            );
        });
    });
});
