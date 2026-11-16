import * as crypto from 'crypto';

/**
 * Deterministic Proof Fingerprint binding Firebase session & verified phone.
 * Eliminates refreshed token replays across the same auth session.
 */
export function createProofFingerprint(uid: string, authTime: number | string, canonicalPhone: string): string {
    const raw = `${uid || ''}:${authTime || ''}:${canonicalPhone || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * General SHA-256 hex digest helper.
 */
export function createSha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Peppered HMAC-SHA256 for short 6-digit OTP codes.
 * Ensures resistance against offline brute force even if database rows leak.
 */
export function createPepperedOtpHash(rawOtp: string, pepper: string): string {
    const secretPepper = pepper || 'default_bazaarbound_secure_otp_pepper_2026';
    return crypto.createHmac('sha256', secretPepper).update(rawOtp.trim()).digest('hex');
}

/**
 * Constant-time comparison for OTP validation to eliminate timing side-channel attacks.
 */
export function verifyPepperedOtpHash(rawOtp: string, pepper: string, expectedHash: string): boolean {
    if (!rawOtp || !expectedHash) return false;
    const computedHash = createPepperedOtpHash(rawOtp, pepper);
    try {
        const computedBuffer = Buffer.from(computedHash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        if (computedBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
    } catch {
        return false;
    }
}
