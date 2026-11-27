/**
 * Field-name fragments that mark a value as a credential. Matching is done on the key with
 * case and separators removed, so `emailPass`, `smtp_password`, `X-Api-Key` and
 * `stripeSecretKey` are all caught without having to list every spelling.
 */
const SENSITIVE_FRAGMENTS = [
    'password',
    'passwd',
    'secret',
    'token',
    'apikey',
    'privatekey',
    'accesskey',
    'authorization',
    'cookie',
    'otp',
    'creditcard',
    'cardnumber',
    'cvv',
    'cvc',
];

/** Short names that would cause false positives as fragments ("pin" is inside "shipping"). */
const SENSITIVE_EXACT = new Set(['pin', 'pass']);

/** Keys that end in "pass" (emailPass, smtpPass) but are not covered by the fragments above. */
const SENSITIVE_SUFFIXES = ['pass'];

const REDACTED = '[REDACTED]';
const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 6;

export class AuditSanitizer {
    /**
     * Returns a copy safe to persist in audit_logs: credentials are redacted, and large
     * payloads (base64 images, long HTML, huge arrays) are truncated so a single request
     * cannot produce an oversized row.
     */
    static sanitize<T>(data: T): T {
        return this.sanitizeValue(data, 0) as T;
    }

    static isSensitiveKey(key: string): boolean {
        const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
            SENSITIVE_EXACT.has(normalized) ||
            SENSITIVE_FRAGMENTS.some((fragment) => normalized.includes(fragment)) ||
            SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
        );
    }

    private static sanitizeValue(value: unknown, depth: number): unknown {
        if (typeof value === 'string') return this.truncate(value);
        if (!value || typeof value !== 'object') return value;
        if (value instanceof Date) return value;
        if (depth >= MAX_DEPTH) return '[TRUNCATED: max depth]';

        if (Array.isArray(value)) {
            const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => this.sanitizeValue(item, depth + 1));
            if (value.length > MAX_ARRAY_ITEMS) items.push(`[TRUNCATED: ${value.length - MAX_ARRAY_ITEMS} more items]`);
            return items;
        }

        const sanitized: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            sanitized[key] = this.isSensitiveKey(key) ? REDACTED : this.sanitizeValue(entry, depth + 1);
        }
        return sanitized;
    }

    private static truncate(value: string): string {
        if (value.startsWith('data:') && value.includes(';base64,')) return '[BINARY DATA OMITTED]';
        return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]` : value;
    }
}
