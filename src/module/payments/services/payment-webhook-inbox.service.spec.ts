import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PaymentWebhookInboxService } from './payment-webhook-inbox.service';
import { PaymentConfirmationService } from './payment-confirmation.service';
import { PaymentWebhookInbox } from '../entities/payment-webhook-inbox.entity';
import { PaymentGateway, InboxStatus, PaymentEventSource } from '../enums/payment.enum';

describe('PaymentWebhookInboxService (Durable Inbox Pattern)', () => {
    let service: PaymentWebhookInboxService;
    let mockDataSource: any;
    let mockConfirmationService: any;
    let mockInboxRepo: any;
    let mockQueryBuilder: any;

    beforeEach(async () => {
        mockQueryBuilder = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
            getMany: jest.fn().mockResolvedValue([]),
        };

        mockInboxRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 'inbox-1' })),
            save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        mockDataSource = {
            getRepository: jest.fn().mockReturnValue(mockInboxRepo),
        };

        mockConfirmationService = {
            confirmPayment: jest.fn().mockResolvedValue({ success: true, paymentStatus: 'PAID' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentWebhookInboxService,
                { provide: DataSource, useValue: mockDataSource },
                { provide: PaymentConfirmationService, useValue: mockConfirmationService },
            ],
        }).compile();

        service = module.get<PaymentWebhookInboxService>(PaymentWebhookInboxService);
    });

    describe('ingestWebhook (Fast-ACK Ingest)', () => {
        it('should ingest and save webhook with deterministic SHA-256 idempotency key', async () => {
            const payload = {
                tran_id: 'SSLCZ-001',
                val_id: 'VAL-101',
                status: 'VALID',
            };

            const result = await service.ingestWebhook(PaymentGateway.SSLCOMMERZ, 'IPN_CALLBACK', payload);

            expect(result.queued).toBe(true);
            expect(result.idempotencyKey).toBeDefined();
            expect(result.idempotencyKey.length).toBe(64); // SHA-256 hex
            expect(mockInboxRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    gateway: PaymentGateway.SSLCOMMERZ,
                    status: InboxStatus.PENDING,
                })
            );
            expect(mockInboxRepo.save).toHaveBeenCalled();
        });

        it('should return queued: true gracefully on duplicate webhook ingestion without crashing', async () => {
            const dupErr: any = new Error('Duplicate entry');
            dupErr.code = 'ER_DUP_ENTRY';
            mockInboxRepo.save.mockRejectedValueOnce(dupErr);

            const payload = {
                tran_id: 'SSLCZ-001',
                val_id: 'VAL-101',
            };

            const result = await service.ingestWebhook(PaymentGateway.SSLCOMMERZ, 'IPN_CALLBACK', payload);

            expect(result.queued).toBe(true);
            expect(result.message).toContain('idempotent');
        });
    });

    describe('processInboxItem (4-Step Worker Pipeline)', () => {
        it('should claim lease, invoke confirmation service, and mark PROCESSED with fencing token', async () => {
            const item: any = {
                id: 'inbox-1',
                payload: {
                    tran_id: 'SSLCZ-001',
                    val_id: 'VAL-101',
                },
                leaseToken: null,
                retryCount: 0,
            };

            mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

            await service.processInboxItem(item);

            expect(mockConfirmationService.confirmPayment).toHaveBeenCalledWith(
                'VAL-101',
                'SSLCZ-001',
                PaymentEventSource.IPN,
                item.payload
            );
            expect(mockQueryBuilder.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: InboxStatus.PROCESSED,
                })
            );
        });

        it('should abort if another worker claimed lease in the meantime (affected === 0)', async () => {
            const item: any = {
                id: 'inbox-1',
                payload: { tran_id: 'SSLCZ-001', val_id: 'VAL-101' },
            };

            // First execute is claim lease
            mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 0 });

            await service.processInboxItem(item);

            expect(mockConfirmationService.confirmPayment).not.toHaveBeenCalled();
        });

        it('should increment retryCount with backoff on failure', async () => {
            const item: any = {
                id: 'inbox-1',
                payload: { tran_id: 'SSLCZ-001', val_id: 'VAL-101' },
                retryCount: 1,
            };

            mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 1 });
            mockConfirmationService.confirmPayment.mockRejectedValue(new Error('Downstream DB error'));

            await service.processInboxItem(item);

            expect(mockInboxRepo.update).toHaveBeenCalledWith(
                'inbox-1',
                expect.objectContaining({
                    status: InboxStatus.PENDING,
                    retryCount: 2,
                    failureReason: 'Downstream DB error',
                })
            );
        });

        it('should transition to DEAD_LETTER after exceeding max retries (5)', async () => {
            const item: any = {
                id: 'inbox-1',
                payload: { tran_id: 'SSLCZ-001', val_id: 'VAL-101' },
                retryCount: 4, // 5th attempt will fail
            };

            mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 1 });
            mockConfirmationService.confirmPayment.mockRejectedValue(new Error('Fatal unrecoverable error'));

            await service.processInboxItem(item);

            expect(mockInboxRepo.update).toHaveBeenCalledWith(
                'inbox-1',
                expect.objectContaining({
                    status: InboxStatus.DEAD_LETTER,
                    retryCount: 5,
                })
            );
        });
    });
});
