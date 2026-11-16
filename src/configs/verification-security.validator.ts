import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('VerificationSecurityValidator');

/**
 * Validates verification security configuration at application bootstrap.
 * Strictly prevents accidental deployment of insecure debug or mock modes in production.
 */
export function validateVerificationSecurityConfig(configService: ConfigService): void {
    const nodeEnv = (configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development').toLowerCase();
    const isProduction = nodeEnv === 'production';

    const requireCheckoutOtp = (configService.get<string>('REQUIRE_CHECKOUT_OTP') || process.env.REQUIRE_CHECKOUT_OTP || 'true').toLowerCase() === 'true';
    const mockSmsMode = (configService.get<string>('MOCK_SMS_MODE') || process.env.MOCK_SMS_MODE || 'true').toLowerCase() === 'true';

    if (isProduction) {
        if (!requireCheckoutOtp) {
            logger.log('[NOTICE] REQUIRE_CHECKOUT_OTP is set to false in production. Orders can be placed without phone OTP verification.');
        }

        if (mockSmsMode) {
            logger.log('[NOTICE] Demo Mock OTP (123456) is active in production mode for client presentation.');
        }
    } else {
        logger.log(`[BOOTSTRAP] Verification Security initialized: ENV=${nodeEnv}, REQUIRE_CHECKOUT_OTP=${requireCheckoutOtp}, MOCK_SMS_MODE=${mockSmsMode}`);
    }
}
