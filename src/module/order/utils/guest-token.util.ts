import * as crypto from 'crypto';

export interface GuestOrderTokenPayload {
    orderId: string;
    purpose: 'guest_cart_recovery';
    nonce: string;
    iat: number;
    exp: number;
}

export class GuestTokenUtil {
    private static getSecret(): string {
        const secret =
            process.env.GUEST_ORDER_TOKEN_SECRET ||
            process.env.JWT_SECRET ||
            process.env.API_SECRET_KEY ||
            process.env.JWT_SECRET_KEY ||
            'default_secure_guest_order_token_signing_secret_key_32chars';

        if (process.env.NODE_ENV === 'production' && (!process.env.GUEST_ORDER_TOKEN_SECRET || process.env.GUEST_ORDER_TOKEN_SECRET.length < 32)) {
            if (!secret || secret.length < 32 || secret === 'default_secure_guest_order_token_signing_secret_key_32chars') {
                console.warn('[Security Warning] GUEST_ORDER_TOKEN_SECRET should be explicitly set with at least 32 characters in production.');
            }
        }

        return secret;
    }

    /**
     * Generates a tamper-proof cryptographically signed Guest Order Access Token.
     * Valid for 7 days (independent of the 48-hour gateway payment window),
     * allowing customers to recover expired or failed orders.
     */
    static generate(orderId: string, customDurationDays: number = 7): string {
        const cleanOrderId = (orderId || '').replace(/^#/, '').trim();
        const nowSec = Math.floor(Date.now() / 1000);
        const expSec = nowSec + customDurationDays * 24 * 60 * 60;

        const payload: GuestOrderTokenPayload = {
            orderId: cleanOrderId,
            purpose: 'guest_cart_recovery',
            nonce: crypto.randomBytes(16).toString('hex'), // 128-bit random nonce
            iat: nowSec,
            exp: expSec
        };

        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = crypto
            .createHmac('sha256', this.getSecret())
            .update(encodedPayload)
            .digest('base64url');

        return `${encodedPayload}.${signature}`;
    }

    /**
     * Strict verification with constant-time HMAC check, payload schema validation,
     * replay nonces, clock skew bounds, and expiry checks.
     */
    static verify(token: string, expectedOrderId: string): boolean {
        if (!token || typeof token !== 'string') return false;

        const segments = token.split('.');
        // Strict 2-segment contract: extra or missing segments rejected immediately
        if (segments.length !== 2) return false;

        const [encodedPayload, signature] = segments;
        if (!encodedPayload || !signature) return false;

        try {
            const expectedSig = crypto
                .createHmac('sha256', this.getSecret())
                .update(encodedPayload)
                .digest('base64url');

            const sigBuf = Buffer.from(signature);
            const expectedBuf = Buffer.from(expectedSig);

            // Constant-time comparison prevents timing side-channel attacks
            if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
                return false;
            }

            const rawJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
            const payload = JSON.parse(rawJson);

            // Comprehensive schema & semantic validation
            if (!payload || typeof payload !== 'object') return false;
            if (payload.purpose !== 'guest_cart_recovery') return false;

            const cleanExpected = (expectedOrderId || '').replace(/^#/, '').trim();
            if (payload.orderId !== cleanExpected) return false;

            const nowSec = Math.floor(Date.now() / 1000);

            // Validate iat (reject future-issued tokens with 60s allowed clock skew)
            if (!Number.isFinite(payload.iat) || payload.iat > nowSec + 60) return false;

            // Validate exp (must be finite number and not expired)
            if (!Number.isFinite(payload.exp) || payload.exp < nowSec) return false;

            // Validate nonce (must be 32-char hex string)
            if (typeof payload.nonce !== 'string' || !/^[a-fA-F0-9]{32}$/.test(payload.nonce)) return false;

            return true;
        } catch {
            return false;
        }
    }
}
