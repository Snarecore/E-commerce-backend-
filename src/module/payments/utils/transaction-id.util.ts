import * as crypto from 'crypto';

export class TransactionIdUtil {
    private static readonly PREFIX = 'SSLCZ';
    private static readonly ORDER_ID_REGEX = /^[a-zA-Z0-9_-]{3,50}$/;
    
    // 🛡️ Backward Compatible Regex:
    // Matches new 128-bit 32-hex format: SSLCZ-BB123456-A1-A1B2C3D4E5F60718293A4B5C6D7E8F90
    // As well as legacy 4-digit format:  SSLCZ-BB123456-A1-4821
    private static readonly TRAN_ID_REGEX = /^SSLCZ-[a-zA-Z0-9_-]{3,50}-A([1-9]|1[0-9]|20)-([A-F0-9]{32}|\d{4})$/;

    /**
     * Generates a 128-bit cryptographically secure, non-colliding transaction ID.
     * Length: ~55-65 characters (well within SSLCommerz 100-char limit and DB 255-char column).
     */
    static generate(orderId: string, attemptIndex: number): string {
        const cleanOrderId = (orderId || '').replace(/^#/, '').trim();
        if (!this.ORDER_ID_REGEX.test(cleanOrderId)) {
            throw new Error(`Invalid orderId format for transaction generation: "${orderId}"`);
        }
        if (!Number.isInteger(attemptIndex) || attemptIndex < 1 || attemptIndex > 20) {
            throw new Error(`Invalid attemptIndex: ${attemptIndex}. Must be an integer between 1 and 20.`);
        }

        // 128-bit cryptographically secure random entropy (32 hex uppercase chars)
        const entropy = crypto.randomBytes(16).toString('hex').toUpperCase();
        return `${this.PREFIX}-${cleanOrderId}-A${attemptIndex}-${entropy}`;
    }

    /**
     * In-memory format and length contract validation (Zero DB overhead).
     */
    static isValidFormat(tranId: unknown): boolean {
        if (!tranId || typeof tranId !== 'string') return false;
        const trimmed = tranId.trim();
        if (trimmed.length < 15 || trimmed.length > 100) return false;
        return this.TRAN_ID_REGEX.test(trimmed);
    }
}
