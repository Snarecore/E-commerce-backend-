const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'pass',
    'token',
    'accesstoken',
    'refreshtoken',
    'resettoken',
    'secret',
    'stripekey',
    'authorization',
    'cookie',
    'creditcard',
    'cvv'
]);

export class AuditSanitizer {
    static sanitize<T>(data: T): T {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.sanitize(item)) as unknown as T;
        }

        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(data as Record<string, any>)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
                sanitized[key] = '[REDACTED]';
            } else if (value && typeof value === 'object') {
                sanitized[key] = this.sanitize(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized as T;
    }
}
