import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { CheckoutPhoneVerification, VerificationStatus, VerificationProviderType } from '../entities/checkout-phone-verification.entity';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { createPepperedOtpHash } from '../../../utils/crypto-hasher.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerificationChallengeService {
    private readonly logger = new Logger(VerificationChallengeService.name);

    constructor(
        @InjectRepository(CheckoutPhoneVerification)
        private readonly verificationRepo: Repository<CheckoutPhoneVerification>,
        private readonly configService: ConfigService
    ) {}

    /**
     * Returns public checkout verification configuration.
     */
    getVerificationConfig(): {
        requireCheckoutOtp: boolean;
        provider: string;
        mockMode: boolean;
        cooldownSeconds: number;
    } {
        const isProd = (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';
        const requireOtpConfig = this.configService.get<string>('REQUIRE_CHECKOUT_OTP') || process.env.REQUIRE_CHECKOUT_OTP;
        // Default to true so OTP checkout verification works seamlessly without needing explicit env vars
        const requireCheckoutOtp = requireOtpConfig !== undefined ? requireOtpConfig.toLowerCase() === 'true' : true;
        const mockModeConfig = this.configService.get<string>('MOCK_SMS_MODE') || process.env.MOCK_SMS_MODE;
        // Default to true for client mock demo mode without requiring SMS API credentials
        const isMockActive = mockModeConfig !== undefined ? mockModeConfig.toLowerCase() === 'true' : true;
        const provider = isMockActive ? VerificationProviderType.MOCK : VerificationProviderType.DIRECT;

        return {
            requireCheckoutOtp,
            provider,
            mockMode: isMockActive,
            cooldownSeconds: 60
        };
    }

    /**
     * Initiates a new verification challenge enforcing distributed rate limits.
     * Prevents OTP bombing while gracefully handling React StrictMode double mounts.
     */
    async initiateChallenge(rawPhone: string, clientIp?: string): Promise<{
        challengeId: string;
        phone: string;
        provider: string;
        expiresAt: Date;
        mockOtpCode?: string;
    }> {
        const canonicalPhone = normalizeBDPhone(rawPhone);
        const isProd = (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production';
        const mockModeConfig = this.configService.get<string>('MOCK_SMS_MODE') || process.env.MOCK_SMS_MODE;
        // Default to true for demo mock OTP mode
        const isMockActive = mockModeConfig !== undefined ? mockModeConfig.toLowerCase() === 'true' : true;
        const provider = isMockActive ? VerificationProviderType.MOCK : VerificationProviderType.DIRECT;

        // 1. StrictMode / Rapid Double-Click Debounce (< 15 seconds)
        // If a pending challenge for this phone was created in the last 15s, return it without 429 error
        const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
        const ultraRecentChallenge = await this.verificationRepo.findOne({
            where: {
                phone: canonicalPhone,
                status: VerificationStatus.PENDING,
                createdAt: MoreThan(fifteenSecondsAgo)
            },
            order: { createdAt: 'DESC' }
        });

        if (ultraRecentChallenge) {
            this.logger.log(`[CHALLENGE DEBOUNCED] Reusing challenge ID=${ultraRecentChallenge.id} for ${canonicalPhone}`);
            return {
                challengeId: ultraRecentChallenge.id,
                phone: canonicalPhone,
                provider: ultraRecentChallenge.provider,
                expiresAt: ultraRecentChallenge.expiresAt,
                mockOtpCode: isMockActive ? '123456' : undefined
            };
        }

        // 2. Enforce 60-Second Cooldown per phone number
        const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
        const recentChallenge = await this.verificationRepo.findOne({
            where: {
                phone: canonicalPhone,
                createdAt: MoreThan(sixtySecondsAgo)
            },
            order: { createdAt: 'DESC' }
        });

        if (recentChallenge) {
            // In Mock Mode, if a recent challenge is still PENDING and valid, seamlessly reuse it so client demo re-tests never get blocked by 429
            if (isMockActive && recentChallenge.status === VerificationStatus.PENDING && recentChallenge.expiresAt && recentChallenge.expiresAt.getTime() > Date.now()) {
                this.logger.log(`[CHALLENGE REUSED] Reusing active pending challenge ID=${recentChallenge.id} for ${canonicalPhone}`);
                return {
                    challengeId: recentChallenge.id,
                    phone: canonicalPhone,
                    provider: recentChallenge.provider,
                    expiresAt: recentChallenge.expiresAt,
                    mockOtpCode: '123456'
                };
            }

            const waitSeconds = Math.ceil((recentChallenge.createdAt.getTime() + 60000 - Date.now()) / 1000);
            throw new HttpException(
                `Too many requests. Please wait ${Math.max(1, waitSeconds)} seconds before requesting a new verification code.`,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // 3. Enforce Hourly Velocity Limit (Max 100 in mock mode, 20 in dev, 5 in prod)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const hourlyCount = await this.verificationRepo.count({
            where: {
                phone: canonicalPhone,
                createdAt: MoreThan(oneHourAgo)
            }
        });

        const maxHourlyChallenges = isMockActive ? 100 : (isProd ? 5 : 20);
        if (hourlyCount >= maxHourlyChallenges) {
            throw new HttpException(
                'Hourly verification limit reached for this phone number. Please try again after 1 hour.',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // 4. Generate 6-Digit OTP Code and cryptographic hash
        const otpCode = isMockActive ? '123456' : crypto.randomInt(100000, 999999).toString();
        const pepper = this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'bazaarbound_otp_pepper_2026';
        const otpCodeHash = createPepperedOtpHash(otpCode, pepper);

        // Challenge TTL: 10 Minutes for PENDING
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const challenge = this.verificationRepo.create({
            phone: canonicalPhone,
            provider,
            status: VerificationStatus.PENDING,
            otpCodeHash,
            attemptCount: 0,
            expiresAt,
            clientIp: clientIp || undefined
        });

        const saved = await this.verificationRepo.save(challenge);

        this.logger.log(`[OTP DISPATCH] ChallengeID=${saved.id} Phone=${canonicalPhone} Code=${isMockActive ? '123456' : otpCode} Provider=${provider}`);

        return {
            challengeId: saved.id,
            phone: canonicalPhone,
            provider,
            expiresAt: saved.expiresAt,
            mockOtpCode: isMockActive ? otpCode : undefined
        };
    }
}
