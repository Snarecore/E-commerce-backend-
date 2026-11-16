jest.mock('firebase-admin/auth', () => ({
    getAuth: jest.fn(() => ({
        verifyIdToken: jest.fn()
    }))
}));
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
    getApps: jest.fn(() => []),
    cert: jest.fn()
}));

import { normalizeBDPhone, isValidBDPhone } from '../../../utils/phone-normalizer.util';
import { createProofFingerprint, createPepperedOtpHash, verifyPepperedOtpHash } from '../../../utils/crypto-hasher.util';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { VerificationChallengeService } from './verification-challenge.service';
import { VerificationOrchestratorService } from './verification-orchestrator.service';
import { VerificationConsumptionService } from './verification-consumption.service';
import { GuestAccountClaimService } from './guest-account-claim.service';
import { CheckoutPhoneVerification, VerificationStatus, VerificationProviderType } from '../entities/checkout-phone-verification.entity';
import { GuestAccountClaim, GuestClaimStatus } from '../entities/guest-account-claim.entity';
import { User } from '../../user/entities/user.entity';
import { Orders } from '../../order/entity/order.entity';

describe('Checkout Verification & Anti-Fraud Unit Tests', () => {
    describe('Bangladeshi Phone Normalizer', () => {
        it('should canonicalize standard 11-digit local format (017XXXXXXXX) to E.164 (+88017XXXXXXXX)', () => {
            expect(normalizeBDPhone('01712345678')).toBe('+8801712345678');
            expect(normalizeBDPhone('01812345678')).toBe('+8801812345678');
            expect(normalizeBDPhone('01912345678')).toBe('+8801912345678');
            expect(normalizeBDPhone('01312345678')).toBe('+8801312345678');
        });

        it('should canonicalize +880 and 880 prefixes to E.164', () => {
            expect(normalizeBDPhone('+8801712345678')).toBe('+8801712345678');
            expect(normalizeBDPhone('8801712345678')).toBe('+8801712345678');
        });

        it('should strip spaces, dashes, and parentheses', () => {
            expect(normalizeBDPhone('017-1234-5678')).toBe('+8801712345678');
            expect(normalizeBDPhone('+88 017 12 34 56 78')).toBe('+8801712345678');
            expect(normalizeBDPhone('(017) 12345678')).toBe('+8801712345678');
        });

        it('should reject invalid operator prefixes (e.g. 010, 011, 012)', () => {
            expect(() => normalizeBDPhone('01012345678')).toThrow(BadRequestException);
            expect(() => normalizeBDPhone('01212345678')).toThrow(BadRequestException);
            expect(isValidBDPhone('01012345678')).toBe(false);
        });

        it('should reject incomplete or oversized phone numbers', () => {
            expect(() => normalizeBDPhone('017123456')).toThrow(BadRequestException);
            expect(() => normalizeBDPhone('01712345678999')).toThrow(BadRequestException);
            expect(() => normalizeBDPhone('')).toThrow(BadRequestException);
        });
    });

    describe('Proof Fingerprint & Replay Attack Defense', () => {
        it('should generate identical proofFingerprint for same uid, auth_time, and phone', () => {
            const fp1 = createProofFingerprint('uid_123', 1700000000, '+8801712345678');
            const fp2 = createProofFingerprint('uid_123', 1700000000, '+8801712345678');
            expect(fp1).toBe(fp2);
        });

        it('should generate distinct proofFingerprint for different auth_time (fresh OTP event)', () => {
            const fp1 = createProofFingerprint('uid_123', 1700000000, '+8801712345678');
            const fp2 = createProofFingerprint('uid_123', 1700000010, '+8801712345678');
            expect(fp1).not.toBe(fp2);
        });
    });

    describe('Peppered HMAC OTP Hash & Constant-Time Validation', () => {
        it('should compute and verify valid peppered OTP', () => {
            const pepper = 'test_secret_pepper_key';
            const otp = '123456';
            const hash = createPepperedOtpHash(otp, pepper);

            expect(hash).toHaveLength(64); // SHA-256 hex length
            expect(verifyPepperedOtpHash(otp, pepper, hash)).toBe(true);
        });

        it('should reject incorrect OTP or mismatched pepper', () => {
            const pepper = 'test_secret_pepper_key';
            const hash = createPepperedOtpHash('123456', pepper);

            expect(verifyPepperedOtpHash('654321', pepper, hash)).toBe(false);
            expect(verifyPepperedOtpHash('123456', 'wrong_pepper', hash)).toBe(false);
        });
    });

    describe('VerificationChallengeService', () => {
        let challengeService: VerificationChallengeService;
        let mockRepo: any;
        let mockConfig: any;

        beforeEach(() => {
            mockRepo = {
                findOne: jest.fn(),
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn((dto) => ({ id: 'ch-uuid-1', ...dto })),
                save: jest.fn((entity) => Promise.resolve({ id: 'ch-uuid-1', ...entity }))
            };
            mockConfig = {
                get: jest.fn((key: string) => {
                    if (key === 'MOCK_SMS_MODE') return 'true';
                    if (key === 'REQUIRE_CHECKOUT_OTP') return 'true';
                    if (key === 'NODE_ENV') return 'development';
                    return undefined;
                })
            };
            challengeService = new VerificationChallengeService(mockRepo, mockConfig);
        });

        it('getVerificationConfig should return configuration object', () => {
            const config = challengeService.getVerificationConfig();
            expect(config.requireCheckoutOtp).toBe(true);
            expect(config.provider).toBe(VerificationProviderType.MOCK);
            expect(config.mockMode).toBe(true);
            expect(config.cooldownSeconds).toBe(60);
        });

        it('initiateChallenge should create new challenge with mock OTP in dev mode', async () => {
            const res = await challengeService.initiateChallenge('01711223344');
            expect(res.challengeId).toBe('ch-uuid-1');
            expect(res.phone).toBe('+8801711223344');
            expect(res.mockOtpCode).toBe('123456');
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('initiateChallenge should debounce and reuse recent challenge created within 15 seconds', async () => {
            const recentChallenge = {
                id: 'ch-existing-1',
                phone: '+8801711223344',
                provider: VerificationProviderType.MOCK,
                status: VerificationStatus.PENDING,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 600000)
            };
            mockRepo.findOne.mockResolvedValueOnce(recentChallenge);

            const res = await challengeService.initiateChallenge('01711223344');
            expect(res.challengeId).toBe('ch-existing-1');
            expect(mockRepo.save).not.toHaveBeenCalled();
        });

        it('initiateChallenge should enforce 60s cooldown if requested after debounce window', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null); // ultra recent (< 15s) not found
            mockRepo.findOne.mockResolvedValueOnce({
                id: 'ch-existing-2',
                createdAt: new Date(Date.now() - 30 * 1000) // 30s ago
            });

            await expect(challengeService.initiateChallenge('01711223344')).rejects.toThrow(HttpException);
        });
    });

    describe('VerificationOrchestratorService', () => {
        let orchestratorService: VerificationOrchestratorService;
        let mockRepo: any;
        let mockFirebase: any;
        let mockProvider: any;
        let mockConfig: any;

        beforeEach(() => {
            mockRepo = {
                findOne: jest.fn(),
                create: jest.fn((dto) => ({ id: 'ch-1', ...dto })),
                save: jest.fn((entity) => Promise.resolve(entity))
            };
            mockFirebase = {
                providerName: 'FIREBASE',
                verifyProof: jest.fn()
            };
            mockProvider = {
                providerName: 'MOCK',
                verifyProof: jest.fn()
            };
            mockConfig = {
                get: jest.fn((key: string) => {
                    if (key === 'MOCK_SMS_MODE') return 'true';
                    if (key === 'NODE_ENV') return 'development';
                    return undefined;
                })
            };
            orchestratorService = new VerificationOrchestratorService(
                mockRepo,
                mockFirebase,
                mockProvider,
                mockConfig
            );
        });

        it('confirmVerification should verify valid OTP code and transition to VERIFIED', async () => {
            const pepper = 'bazaarbound_otp_pepper_2026';
            const otpCode = '123456';
            const otpCodeHash = createPepperedOtpHash(otpCode, pepper);

            const challenge = {
                id: 'ch-1',
                phone: '+8801711223344',
                status: VerificationStatus.PENDING,
                otpCodeHash,
                attemptCount: 0,
                expiresAt: new Date(Date.now() + 600000),
                provider: VerificationProviderType.MOCK
            };
            mockRepo.findOne.mockResolvedValueOnce(challenge); // find by challengeId
            mockRepo.findOne.mockResolvedValueOnce(null); // find existing fingerprint

            const res = await orchestratorService.confirmVerification({
                challengeId: 'ch-1',
                phone: '01711223344',
                otpCode: '123456'
            });

            expect(res.verificationId).toBe('ch-1');
            expect(res.phone).toBe('+8801711223344');
            expect(challenge.status).toBe(VerificationStatus.VERIFIED);
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('confirmVerification should reject invalid OTP code and increment attemptCount', async () => {
            const pepper = 'bazaarbound_otp_pepper_2026';
            const otpCodeHash = createPepperedOtpHash('999999', pepper);

            const challenge = {
                id: 'ch-1',
                phone: '+8801711223344',
                status: VerificationStatus.PENDING,
                otpCodeHash,
                attemptCount: 0,
                expiresAt: new Date(Date.now() + 600000),
                provider: VerificationProviderType.DIRECT
            };
            mockRepo.findOne.mockResolvedValueOnce(challenge);

            // In production/direct mode with mismatched code
            mockConfig.get.mockImplementation((k: string) => k === 'MOCK_SMS_MODE' ? 'false' : undefined);

            await expect(
                orchestratorService.confirmVerification({
                    challengeId: 'ch-1',
                    phone: '01711223344',
                    otpCode: '000000'
                })
            ).rejects.toThrow(BadRequestException);

            expect(challenge.attemptCount).toBe(1);
            expect(mockRepo.save).toHaveBeenCalledWith(challenge);
        });
    });

    describe('VerificationConsumptionService', () => {
        let consumptionService: VerificationConsumptionService;
        let mockQueryRunner: any;

        beforeEach(() => {
            consumptionService = new VerificationConsumptionService();
            mockQueryRunner = {
                manager: {
                    createQueryBuilder: jest.fn().mockReturnValue({
                        update: jest.fn().mockReturnThis(),
                        set: jest.fn().mockReturnThis(),
                        where: jest.fn().mockReturnThis(),
                        andWhere: jest.fn().mockReturnThis(),
                        execute: jest.fn().mockResolvedValue({ affected: 1 })
                    }),
                    findOne: jest.fn().mockResolvedValue({
                        id: 'v-100',
                        phone: '+8801711223344',
                        provider: 'MOCK',
                        verifiedAt: new Date(),
                        orderId: 'ORD-123'
                    })
                }
            };
        });

        it('should atomically consume verified challenge inside database transaction', async () => {
            const res = await consumptionService.consumeVerificationInTransaction(
                mockQueryRunner,
                'v-100',
                '01711223344',
                'ORD-123'
            );

            expect(res.verificationId).toBe('v-100');
            expect(res.phone).toBe('+8801711223344');
            expect(res.orderId).toBe('ORD-123');
        });
    });

    describe('GuestAccountClaimService', () => {
        let claimService: GuestAccountClaimService;
        let mockClaimRepo: any;
        let mockDataSource: any;
        let mockQueryRunner: any;

        beforeEach(() => {
            mockClaimRepo = {
                create: jest.fn((dto) => dto),
                save: jest.fn((entity) => Promise.resolve(entity))
            };
            mockQueryRunner = {
                connect: jest.fn().mockResolvedValue(undefined),
                startTransaction: jest.fn().mockResolvedValue(undefined),
                commitTransaction: jest.fn().mockResolvedValue(undefined),
                rollbackTransaction: jest.fn().mockResolvedValue(undefined),
                release: jest.fn().mockResolvedValue(undefined),
                manager: {
                    findOne: jest.fn(),
                    create: jest.fn((cls, dto) => ({ id: 'usr-new-1', ...dto })),
                    save: jest.fn((entity) => Promise.resolve({ id: 'usr-new-1', ...entity }))
                }
            };
            mockDataSource = {
                createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner)
            };
            claimService = new GuestAccountClaimService(
                mockClaimRepo,
                mockDataSource
            );
        });

        it('issueClaimToken should generate opaque hex secret and store hash', async () => {
            const token = await claimService.issueClaimToken('ORD-101', '01711223344');
            expect(token).toHaveLength(64); // 32 bytes hex
            expect(mockClaimRepo.save).toHaveBeenCalled();
        });

        it('claimAccount should create new User and link Order (session cookies are issued by the controller)', async () => {
            const claimRecord = {
                id: 'claim-1',
                orderId: 'ORD-101',
                phone: '+8801711223344',
                status: GuestClaimStatus.ISSUED,
                expiresAt: new Date(Date.now() + 86400000)
            };
            const orderRecord = {
                id: 'ord-1',
                orderId: 'ORD-101',
                shippingAddress: { name: 'Rahim Khan', email: 'rahim@example.com' }
            };

            // find claim
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(claimRecord);
            // find existing user by phone (null = phone free)
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
            // find order
            mockQueryRunner.manager.findOne.mockResolvedValueOnce(orderRecord);

            const res = await claimService.claimAccount('some_valid_claim_secret_token_123', 'Password123!', 'Rahim Khan');

            expect(res.user.id).toBe('usr-new-1');
            expect(res).not.toHaveProperty('accessToken');
            expect(claimRecord.status).toBe(GuestClaimStatus.CONSUMED);
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });
    });
});
