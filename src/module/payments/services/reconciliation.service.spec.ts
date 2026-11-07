import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ReconciliationService } from './reconciliation.service';
import { SslcommerzService } from './sslcommerz.service';
import { PaymentConfirmationService } from './payment-confirmation.service';
import { PaymentAttemptStatus, PaymentGateway } from '../enums/payment.enum';

describe('ReconciliationService', () => {
    let service: ReconciliationService;
    let mockDataSource: any;
    let mockSslcommerzService: any;
    let mockPaymentConfirmationService: any;
    let mockQueryRunner: any;

    beforeEach(async () => {
        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            query: jest.fn(),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                find: jest.fn(),
                save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            },
        };

        mockDataSource = {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        mockSslcommerzService = {
            queryTransaction: jest.fn(),
        };

        mockPaymentConfirmationService = {
            confirmPayment: jest.fn(),
            handleFailedAttempt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReconciliationService,
                { provide: DataSource, useValue: mockDataSource },
                { provide: SslcommerzService, useValue: mockSslcommerzService },
                { provide: PaymentConfirmationService, useValue: mockPaymentConfirmationService },
            ],
        }).compile();

        service = module.get<ReconciliationService>(ReconciliationService);
    });

    it('should skip reconciliation if advisory lock is already held by another instance', async () => {
        mockQueryRunner.query.mockResolvedValueOnce([{ isLocked: 0 }]); // Lock denied

        await service.reconcilePendingPayments();

        expect(mockQueryRunner.manager.find).not.toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should reconcile and confirm payments when gateway reports VALID', async () => {
        mockQueryRunner.query
            .mockResolvedValueOnce([{ isLocked: 1 }]) // Lock acquired
            .mockResolvedValueOnce([{ isReleased: 1 }]); // Lock release

        const candidatePayment: any = {
            id: 'pay-rec-1',
            tranId: 'SSLCZ-REC-001',
            gateway: PaymentGateway.SSLCOMMERZ,
            status: PaymentAttemptStatus.PENDING,
            reconciliationAttempts: 1,
        };

        mockQueryRunner.manager.find.mockResolvedValueOnce([candidatePayment]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'OK',
            element: [
                {
                    tran_id: 'SSLCZ-REC-001',
                    val_id: 'VAL-REC-111',
                    status: 'VALID',
                    amount: '1200.00',
                },
            ],
        });

        await service.reconcilePendingPayments();

        expect(mockPaymentConfirmationService.confirmPayment).toHaveBeenCalledWith(
            'VAL-REC-111',
            'SSLCZ-REC-001',
            expect.anything(),
            expect.anything()
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
            expect.stringContaining('RELEASE_LOCK')
        );
    });

    it('should increment backoff and schedule nextCheckAt when payment is still pending at gateway', async () => {
        mockQueryRunner.query
            .mockResolvedValueOnce([{ isLocked: 1 }])
            .mockResolvedValueOnce([{ isReleased: 1 }]);

        const candidatePayment: any = {
            id: 'pay-rec-2',
            tranId: 'SSLCZ-REC-002',
            gateway: PaymentGateway.SSLCOMMERZ,
            status: PaymentAttemptStatus.PENDING,
            reconciliationAttempts: 1,
            nextCheckAt: null,
        };

        mockQueryRunner.manager.find.mockResolvedValueOnce([candidatePayment]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'OK',
            element: [
                {
                    tran_id: 'SSLCZ-REC-002',
                    status: 'PENDING',
                },
            ],
        });

        await service.reconcilePendingPayments();

        expect(candidatePayment.reconciliationAttempts).toBe(2);
        expect(candidatePayment.nextCheckAt).toBeInstanceOf(Date);
        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(candidatePayment);
    });

    it('should flag for admin review when max 5 reconciliation attempts are reached', async () => {
        mockQueryRunner.query
            .mockResolvedValueOnce([{ isLocked: 1 }])
            .mockResolvedValueOnce([{ isReleased: 1 }]);

        const candidatePayment: any = {
            id: 'pay-rec-3',
            tranId: 'SSLCZ-REC-003',
            gateway: PaymentGateway.SSLCOMMERZ,
            status: PaymentAttemptStatus.PENDING,
            reconciliationAttempts: 4, // Next will be 5 -> max reached
        };

        mockQueryRunner.manager.find.mockResolvedValueOnce([candidatePayment]);

        mockSslcommerzService.queryTransaction.mockResolvedValueOnce({
            APIConnect: 'DONE',
            status: 'FAILED',
            element: [],
        });

        await service.reconcilePendingPayments();

        expect(candidatePayment.reconciliationAttempts).toBe(5);
        expect(candidatePayment.needsAdminReview).toBe(true);
        expect(candidatePayment.adminReviewReason).toBe('RECONCILIATION_STUCK');
    });
});
