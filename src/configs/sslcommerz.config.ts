import { registerAs } from '@nestjs/config';

export interface SslcommerzConfig {
    storeId: string;
    storePassword: string;
    isLive: boolean;
    sessionUrl: string;
    validationUrl: string;
    queryUrl: string;
}

export default registerAs('sslcommerz', (): SslcommerzConfig => {
    const isProd = process.env.NODE_ENV === 'production';
    const storeId = (process.env.SSLCOMMERZ_STORE_ID || '').trim();
    const storePassword = (process.env.SSLCOMMERZ_STORE_PASSWORD || '').trim();
    const rawIsLive = (process.env.SSLCOMMERZ_IS_LIVE || '').trim().toLowerCase();

    // Strict boolean evaluation (rejects 'yes', '1', 'live', etc.)
    const isLive = rawIsLive === 'true';

    // 🛡️ Universal Live-Mode Assertion (Applicable in Dev, Staging, and Production)
    if (isLive) {
        if (!storeId || storeId.toLowerCase() === 'testbox') {
            throw new Error('[FATAL CONFIG] Live mode requires a valid non-placeholder SSLCOMMERZ_STORE_ID.');
        }
        if (!storePassword || storePassword.toLowerCase() === 'qwerty') {
            throw new Error('[FATAL CONFIG] Live mode requires a valid non-placeholder SSLCOMMERZ_STORE_PASSWORD.');
        }
    }

    // 🛡️ Production Mode Requirement (Live mode is mandatory in production)
    if (isProd) {
        if (!isLive) {
            throw new Error('[FATAL CONFIG] SSLCOMMERZ_IS_LIVE must be strictly set to "true" in production mode.');
        }
    }

    const liveEndpoints = {
        sessionUrl: 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
        validationUrl: 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php',
        queryUrl: 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
    };

    const sandboxEndpoints = {
        sessionUrl: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
        validationUrl: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
        queryUrl: 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
    };

    return {
        storeId: storeId || 'testbox',
        storePassword: storePassword || 'qwerty',
        isLive,
        ...(isLive ? liveEndpoints : sandboxEndpoints)
    };
});
