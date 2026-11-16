import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IVerificationProvider, ConfirmVerificationDto } from '../interfaces/verification-provider.interface';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';
import { createProofFingerprint } from '../../../utils/crypto-hasher.util';

@Injectable()
export class MockPhoneProvider implements IVerificationProvider {
    readonly providerName = 'MOCK';
    private readonly logger = new Logger(MockPhoneProvider.name);

    constructor(private readonly configService: ConfigService) {}

    async verifyProof(dto: ConfirmVerificationDto): Promise<{
        canonicalPhone: string;
        firebaseUid: string;
        proofFingerprint: string;
        authTime: number;
    }> {
        const mockMode = (this.configService?.get<string>('MOCK_SMS_MODE') || process.env.MOCK_SMS_MODE || 'true').toLowerCase() === 'true';
        if (!mockMode) {
            throw new ForbiddenException('Mock phone verification is currently disabled.');
        }

        const canonicalPhone = normalizeBDPhone(dto.phone);
        const code = (dto.otpCode || dto.firebaseIdToken || '').trim();

        // Standard mock OTP code: "123456" or "DEMO_TOKEN"
        if (code !== '123456' && !code.startsWith('MOCK_') && !code.startsWith('DEMO_')) {
            throw new BadRequestException('Invalid mock verification code. In development/mock mode, use code "123456".');
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const mockUid = `mock_user_${canonicalPhone.replace(/\D/g, '')}`;
        const proofFingerprint = createProofFingerprint(mockUid, nowSeconds, canonicalPhone);

        this.logger.log(`[MOCK VERIFIER] Successfully verified mock phone: ${canonicalPhone}`);

        return {
            canonicalPhone,
            firebaseUid: mockUid,
            proofFingerprint,
            authTime: nowSeconds
        };
    }
}
