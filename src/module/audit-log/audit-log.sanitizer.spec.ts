import { AuditSanitizer } from './audit-log.sanitizer';

describe('AuditSanitizer', () => {
    it('redacts credentials under any spelling', () => {
        const out = AuditSanitizer.sanitize({
            emailPass: 'smtp-secret',
            smtp_password: 'x',
            stripeSecretKey: 'sk_live',
            'X-Api-Key': 'k',
            refreshToken: 't',
            otpCode: '123456',
            nested: [{ cardNumber: '4242' }],
        });
        expect(JSON.stringify(out)).not.toMatch(/smtp-secret|sk_live|4242|123456/);
        expect(out).toMatchObject({ emailPass: '[REDACTED]', nested: [{ cardNumber: '[REDACTED]' }] });
    });

    it('keeps ordinary business fields', () => {
        const input = { shippingAddress: 'Dhaka', searchKeyword: 'shirt', idempotencyKey: 'abc', status: 'Shipped' };
        expect(AuditSanitizer.sanitize(input)).toEqual(input);
    });

    it('truncates oversized payloads', () => {
        const out = AuditSanitizer.sanitize({
            image: 'data:image/png;base64,AAAA',
            description: 'a'.repeat(5000),
            items: Array.from({ length: 80 }, (_, i) => i),
        });
        expect(out.image).toBe('[BINARY DATA OMITTED]');
        expect(out.description.length).toBeLessThan(1100);
        expect(out.items).toHaveLength(51);
    });
});
