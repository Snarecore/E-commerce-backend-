import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAuth } from 'firebase-admin/auth';
import { IVerificationProvider, ConfirmVerificationDto } from '../interfaces/verification-provider.interface';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { createProofFingerprint } from '../../../utils/crypto-hasher.util';
import { ensureFirebaseAdmin } from '../../../utils/firebase-admin.util';

@Injectable()
export class FirebasePhoneProvider implements IVerificationProvider {
    readonly providerName = 'FIREBASE';
    private readonly logger = new Logger(FirebasePhoneProvider.name);
    private isInitialized = false;

    constructor(private readonly configService: ConfigService) {
        this.initializeFirebase();
    }

    private initializeFirebase(): void {
        this.isInitialized = ensureFirebaseAdmin((key) => this.configService.get<string>(key));
    }

    async verifyProof(dto: ConfirmVerificationDto): Promise<{
        canonicalPhone: string;
        firebaseUid: string;
        proofFingerprint: string;
        authTime: number;
    }> {
        if (!dto.firebaseIdToken) {
            throw new BadRequestException('Firebase ID token is required for phone verification.');
        }

        if (!this.isInitialized) {
            throw new BadRequestException(
                'Firebase service is not initialized on the server. Please ensure environment variables are configured.'
            );
        }

        try {
            // Check revocation by passing checkRevoked = true
            const decodedToken = await getAuth().verifyIdToken(dto.firebaseIdToken, true);

            // 1. Verify audience/project matches
            const expectedProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID') || process.env.FIREBASE_PROJECT_ID;
            if (expectedProjectId && decodedToken.aud !== expectedProjectId) {
                throw new UnauthorizedException('Token audience does not match configured Firebase project.');
            }

            // 2. Verify token has verified phone number claim
            if (!decodedToken.phone_number) {
                throw new BadRequestException(
                    'Firebase ID token does not contain a verified phone number claim. Ensure you verified with Phone Auth.'
                );
            }

            // 3. Strict auth_time freshness validation (max 5 minutes = 300 seconds)
            const nowSeconds = Math.floor(Date.now() / 1000);
            const tokenAuthTime = Number(decodedToken.auth_time) || 0;
            const MAX_FRESHNESS_SECONDS = 300; // 5 minutes

            if (nowSeconds - tokenAuthTime > MAX_FRESHNESS_SECONDS) {
                throw new BadRequestException(
                    'Phone verification session has expired. Please verify your phone number again.'
                );
            }

            // 4. E.164 Bangladeshi phone normalization and matching
            const canonicalPhone = normalizeBDPhone(decodedToken.phone_number);
            const requestedPhone = normalizeBDPhone(dto.phone);

            if (canonicalPhone !== requestedPhone) {
                throw new BadRequestException(
                    `Phone number mismatch: Verification code was issued to "${canonicalPhone}", but requested for "${requestedPhone}".`
                );
            }

            // 5. Build deterministic Proof Fingerprint (binds uid + auth_time + canonicalPhone)
            const proofFingerprint = createProofFingerprint(decodedToken.uid, tokenAuthTime, canonicalPhone);

            return {
                canonicalPhone,
                firebaseUid: decodedToken.uid,
                proofFingerprint,
                authTime: tokenAuthTime
            };
        } catch (error: any) {
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                throw error;
            }
            this.logger.warn(`Firebase token verification failed: ${error?.message}`);
            throw new UnauthorizedException(`Invalid or expired Firebase ID token: ${error?.message || 'Authentication error'}`);
        }
    }
}
