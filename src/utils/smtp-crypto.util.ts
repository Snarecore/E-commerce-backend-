import * as crypto from 'crypto';

/**
 * Derives a consistent 32-byte key from the application secret.
 */
function deriveKey(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret || 'bazaarbound_smtp_secret_2026').digest();
}

/**
 * Encrypts sensitive SMTP password using AES-256-CBC.
 * Output format: `ivHex:cipherHex`
 */
export function encryptSmtpPassword(plainText: string, secret: string): string {
    if (!plainText) return '';
    const key = deriveKey(secret);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts sensitive SMTP password.
 * Gracefully handles unencrypted legacy text if found.
 */
export function decryptSmtpPassword(cipherText: string, secret: string): string {
    if (!cipherText) return '';
    if (!cipherText.includes(':')) {
        // Unencrypted fallback
        return cipherText;
    }
    try {
        const [ivHex, encryptedHex] = cipherText.split(':');
        const key = deriveKey(secret);
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return cipherText;
    }
}
