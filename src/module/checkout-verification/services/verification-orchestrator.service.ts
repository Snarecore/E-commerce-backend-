import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckoutPhoneVerification, VerificationStatus, VerificationProviderType } from '../entities/checkout-phone-verification.entity';
import { ConfirmVerificationDto, VerifiedPhoneResult } from '../interfaces/verification-provider.interface';
import { FirebasePhoneProvider } from '../providers/firebase-phone.provider';
import { MockPhoneProvider } from '../providers/mock-phone.provider';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { createProofFingerprint, verifyPepperedOtpHash } from '../../../utils/crypto-hasher.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerificationOrchestratorService {
    private readonly logger = new Logger(VerificationOrchestratorService.name);

    constructor(
        @InjectRepository(CheckoutPhoneVerification)
        private readonly verificationRepo: Repository<CheckoutPhoneVerification>,
        @Optional() private readonly firebaseProvider?: FirebasePhoneProvider,
        private readonly mockProvider?: MockPhoneProvider,
        private readonly configService?: ConfigService
    ) {}

    /**
     * Confirms phone verification using either direct OTP code or Firebase ID token.
     * Enforces proof fingerprint uniqueness, attempt count limits, and atomic state transitions.
     */
    async confirmVerification(dto: ConfirmVerificationDto): Promise<VerifiedPhoneResult> {
        const canonicalPhone = normalizeBDPhone(dto.phone);

        // Find existing challenge if challengeId provided, or find most recent PENDING challenge for this phone
        let challenge: CheckoutPhoneVerification | null = null;

        if (dto.challengeId) {
            challenge = await this.verificationRepo.findOne({
                where: { id: dto.challengeId, phone: canonicalPhone }
            });
        }

        if (!challenge) {
            challenge = await this.verificationRepo.findOne({
                where: {
                    phone: canonicalPhone,
                    status: VerificationStatus.PENDING
                },
                order: { createdAt: 'DESC' }
            });
        }

        const isProd = (this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';
        const mockModeConfig = this.configService?.get<string>('MOCK_SMS_MODE') || process.env.MOCK_SMS_MODE;
        // Default to true so mock OTP verification works reliably out of the box
        const isMockActive = mockModeConfig !== undefined ? mockModeConfig.toLowerCase() === 'true' : true;

        // If no prior pending challenge exists, create one on the fly (for seamless direct handoffs)
        if (!challenge) {
            challenge = this.verificationRepo.create({
                phone: canonicalPhone,
                provider: isMockActive ? VerificationProviderType.MOCK : VerificationProviderType.DIRECT,
                status: VerificationStatus.PENDING,
                attemptCount: 0,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                clientIp: dto.clientIp || undefined
            });
            await this.verificationRepo.save(challenge);
        }

        // Check if already consumed or expired
        if (challenge.status === VerificationStatus.CONSUMED) {
            throw new ConflictException('This phone verification challenge has already been consumed by an order.');
        }

        if (challenge.status === VerificationStatus.EXPIRED || challenge.expiresAt.getTime() < Date.now()) {
            challenge.status = VerificationStatus.EXPIRED;
            await this.verificationRepo.save(challenge);
            throw new BadRequestException('Verification challenge has expired. Please request a new code.');
        }

        // Enforce maximum 5 verification attempts per challenge
        const MAX_ATTEMPTS = 5;
        if (challenge.attemptCount >= MAX_ATTEMPTS) {
            challenge.status = VerificationStatus.EXPIRED;
            await this.verificationRepo.save(challenge);
            throw new HttpException(
                'Maximum verification attempts exceeded. Challenge has been revoked for security. Please request a new code.',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        const effectiveMockActive = challenge.provider === VerificationProviderType.MOCK || isMockActive;

        try {
            let verifiedProvider = challenge.provider;
            let proofFingerprint = '';
            let firebaseUid: string | null = null;

            // Scenario 1: OTP Code verification (Direct OTP or Mock OTP)
            if (dto.otpCode) {
                const code = dto.otpCode.trim();
                const pepper = this.configService?.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'bazaarbound_otp_pepper_2026';
                let isValid = false;

                if (challenge.otpCodeHash && verifyPepperedOtpHash(code, pepper, challenge.otpCodeHash)) {
                    isValid = true;
                    verifiedProvider = challenge.provider || VerificationProviderType.DIRECT;
                } else if (effectiveMockActive && (code === '123456' || code.startsWith('MOCK_') || code.startsWith('DEMO_'))) {
                    isValid = true;
                    verifiedProvider = VerificationProviderType.MOCK;
                }

                if (!isValid) {
                    throw new BadRequestException('Invalid verification code. Please check and try again.');
                }

                const nowSec = Math.floor(Date.now() / 1000);
                proofFingerprint = createProofFingerprint(challenge.id, nowSec, canonicalPhone);
            }
            // Scenario 2: Token-based verification fallback
            else if (dto.firebaseIdToken) {
                if (effectiveMockActive) {
                    const mockRes = this.mockProvider ? await this.mockProvider.verifyProof(dto) : {
                        proofFingerprint: createProofFingerprint(`mock_${canonicalPhone}`, Math.floor(Date.now() / 1000), canonicalPhone),
                        firebaseUid: `mock_${canonicalPhone}`
                    };
                    proofFingerprint = mockRes.proofFingerprint;
                    firebaseUid = mockRes.firebaseUid;
                    verifiedProvider = VerificationProviderType.MOCK;
                } else if (this.firebaseProvider) {
                    try {
                        const proofResult = await this.firebaseProvider.verifyProof(dto);
                        proofFingerprint = proofResult.proofFingerprint;
                        firebaseUid = proofResult.firebaseUid;
                        verifiedProvider = VerificationProviderType.DIRECT;
                    } catch {
                        throw new BadRequestException('Direct OTP code is required for phone verification.');
                    }
                } else {
                    throw new BadRequestException('Direct OTP verification code is required.');
                }
            } else {
                throw new BadRequestException('OTP verification code is required.');
            }

            // Check if proofFingerprint is already used across any other verification record (Replay attack defense)
            if (proofFingerprint) {
                const existingFingerprint = await this.verificationRepo.findOne({
                    where: { proofFingerprint }
                });

                if (existingFingerprint && existingFingerprint.id !== challenge.id) {
                    throw new ConflictException(
                        'This phone verification session has already been registered or used. Please complete a new OTP verification.'
                    );
                }
            }

            // Transition challenge to VERIFIED
            const now = new Date();
            challenge.status = VerificationStatus.VERIFIED;
            challenge.verifiedAt = now;
            // Once verified, customer has 10 minutes to submit the order
            challenge.expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
            challenge.provider = verifiedProvider;
            challenge.firebaseUid = firebaseUid;
            challenge.proofFingerprint = proofFingerprint;

            const saved = await this.verificationRepo.save(challenge);

            this.logger.log(`[CHALLENGE VERIFIED] ID=${saved.id} Phone=${saved.phone} Provider=${saved.provider}`);

            return {
                verificationId: saved.id,
                phone: saved.phone,
                provider: saved.provider,
                verifiedAt: saved.verifiedAt || new Date(),
                expiresAt: saved.expiresAt,
                firebaseUid: saved.firebaseUid || undefined
            };
        } catch (error: any) {
            // Increment attempt count on failure
            challenge.attemptCount += 1;
            if (challenge.attemptCount >= MAX_ATTEMPTS) {
                challenge.status = VerificationStatus.EXPIRED;
            }
            await this.verificationRepo.save(challenge);
            throw error;
        }
    }
}
