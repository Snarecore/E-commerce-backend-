import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SslcommerzService } from './sslcommerz.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SslcommerzService', () => {
    let service: SslcommerzService;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'SSLCOMMERZ_STORE_ID') return 'test_store_id';
            if (key === 'SSLCOMMERZ_STORE_PASSWORD') return 'test_store_password';
            if (key === 'SSLCOMMERZ_IS_LIVE') return 'false';
            return null;
        }),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SslcommerzService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<SslcommerzService>(SslcommerzService);
    });

    it('should be defined with sandbox URLs when SSLCOMMERZ_IS_LIVE=false', () => {
        expect(service).toBeDefined();
        expect(service.getStoreId()).toBe('test_store_id');
        expect(service.getIsLive()).toBe(false);
    });

    it('should initialize live URLs when SSLCOMMERZ_IS_LIVE=true', async () => {
        const liveConfigService = {
            get: jest.fn((key: string) => {
                if (key === 'SSLCOMMERZ_IS_LIVE') return 'true';
                if (key === 'SSLCOMMERZ_STORE_ID') return 'live_store';
                return 'live_pass';
            }),
        };

        const liveModule = await Test.createTestingModule({
            providers: [
                SslcommerzService,
                { provide: ConfigService, useValue: liveConfigService },
            ],
        }).compile();

        const liveService = liveModule.get<SslcommerzService>(SslcommerzService);
        expect(liveService.getIsLive()).toBe(true);
    });

    describe('initiatePaymentSession', () => {
        it('should successfully initiate payment session and return gatewayPageUrl', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    status: 'SUCCESS',
                    sessionkey: 'test_session_key_123',
                    GatewayPageURL: 'https://sandbox.sslcommerz.com/EasyCheckOut/test_session_key_123',
                },
            });

            const result = await service.initiatePaymentSession({
                tranId: 'SSLCZ-TEST-001',
                amount: '1250.00',
                currency: 'BDT',
                customerName: 'Rahim Khan',
                customerEmail: 'rahim@example.com',
                customerPhone: '01711111111',
                customerAddress: 'Dhanmondi, Dhaka',
                customerCity: 'Dhaka',
                orderId: 'ORD-1001',
                successUrl: 'http://localhost:5000/api/v1/payments/sslcommerz/success',
                failUrl: 'http://localhost:5000/api/v1/payments/sslcommerz/fail',
                cancelUrl: 'http://localhost:5000/api/v1/payments/sslcommerz/cancel',
                ipnUrl: 'http://localhost:5000/api/v1/payments/sslcommerz/ipn',
            });

            expect(result.status).toBe('SUCCESS');
            expect(result.gatewayPageUrl).toBe('https://sandbox.sslcommerz.com/EasyCheckOut/test_session_key_123');
            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        });

        it('should return FAILED status if gateway rejects session initiation', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    status: 'FAILED',
                    failedreason: 'Store Credential Error',
                },
            });

            const result = await service.initiatePaymentSession({
                tranId: 'SSLCZ-TEST-002',
                amount: '500.00',
                currency: 'BDT',
                customerName: 'Test',
                customerPhone: '01800000000',
                customerAddress: 'Dhaka',
                customerCity: 'Dhaka',
                orderId: 'ORD-1002',
                successUrl: 'http://localhost/success',
                failUrl: 'http://localhost/fail',
                cancelUrl: 'http://localhost/cancel',
                ipnUrl: 'http://localhost/ipn',
            });

            expect(result.status).toBe('FAILED');
            expect(result.failedReason).toBe('Store Credential Error');
        });
    });

    describe('validateTransaction', () => {
        it('should call validation URL and return validation response', async () => {
            const mockValData = {
                status: 'VALID',
                val_id: 'VAL-12345',
                amount: '1250.00',
                currency: 'BDT',
                bank_tran_id: 'BANK-999',
                card_type: 'BKASH-bKash',
                risk_level: '0',
            };

            mockedAxios.get.mockResolvedValueOnce({ data: mockValData });

            const result = await service.validateTransaction('VAL-12345');

            expect(result.status).toBe('VALID');
            expect(result.val_id).toBe('VAL-12345');
            expect(result.bank_tran_id).toBe('BANK-999');
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('validationserverAPI.php'),
                expect.objectContaining({
                    params: expect.objectContaining({
                        val_id: 'VAL-12345',
                        store_id: 'test_store_id',
                    }),
                })
            );
        });

        it('should throw if validation network call fails', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

            await expect(service.validateTransaction('VAL-ERROR')).rejects.toThrow();
        });
    });

    describe('queryTransaction', () => {
        it('should query merchant transaction by tran_id', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    APIConnect: 'DONE',
                    status: 'OK',
                    element: [
                        {
                            tran_id: 'SSLCZ-001',
                            status: 'VALID',
                            val_id: 'VAL-111',
                            amount: '1000.00',
                        },
                    ],
                },
            });

            const result = await service.queryTransaction('SSLCZ-001');

            expect(result.status).toBe('OK');
            expect(result.element?.[0]?.val_id).toBe('VAL-111');
        });
    });
});
