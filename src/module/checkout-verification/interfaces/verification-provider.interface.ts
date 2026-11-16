import { QueryRunner } from 'typeorm';

export interface VerificationChallengeDto {
    phone: string;
    clientIp?: string;
}

export interface ConfirmVerificationDto {
    challengeId?: string;
    phone: string;
    firebaseIdToken?: string;
    otpCode?: string;
    clientIp?: string;
}

export interface VerifiedPhoneResult {
    verificationId: string;
    phone: string;
    provider: string;
    verifiedAt: Date;
    expiresAt: Date;
    firebaseUid?: string;
}

export interface ConsumedVerification {
    verificationId: string;
    phone: string;
    provider: string;
    verifiedAt: Date;
    orderId: string;
}

export interface IVerificationProvider {
    readonly providerName: string;

    /**
     * Verifies the cryptographic proof or OTP code and returns authoritative phone and session fingerprint.
     */
    verifyProof(dto: ConfirmVerificationDto): Promise<{
        canonicalPhone: string;
        firebaseUid?: string;
        proofFingerprint?: string;
        authTime?: number;
    }>;
}
