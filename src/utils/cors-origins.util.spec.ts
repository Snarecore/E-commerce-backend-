import { isOriginAllowed } from './cors-origins.util';

describe('isOriginAllowed', () => {
    const saved = { ...process.env };

    afterEach(() => {
        process.env = { ...saved };
    });

    describe('in production', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = 'https://shop.com, https://admin.shop.com/';
            delete process.env.FRONTEND_URL;
            delete process.env.ADMIN_URL;
            delete process.env.APP_URL;
            delete process.env.CORS_ORIGINS;
        });

        it('allows configured origins, ignoring case and a trailing slash', () => {
            expect(isOriginAllowed('https://shop.com')).toBe(true);
            expect(isOriginAllowed('https://ADMIN.shop.com')).toBe(true);
        });

        it('rejects a look-alike domain that only shares a prefix', () => {
            expect(isOriginAllowed('https://shop.com.evil.net')).toBe(false);
        });

        it('rejects unknown origins and localhost', () => {
            expect(isOriginAllowed('https://evil.net')).toBe(false);
            expect(isOriginAllowed('http://localhost:3000')).toBe(false);
        });

        it('ignores a wildcard entry', () => {
            process.env.CORS_ORIGINS = '*';
            expect(isOriginAllowed('https://evil.net')).toBe(false);
        });

        it('honours the legacy FRONTEND_URL setting', () => {
            process.env.FRONTEND_URL = 'https://www.shop.com';
            expect(isOriginAllowed('https://www.shop.com')).toBe(true);
        });

        it('allows requests without an Origin header', () => {
            expect(isOriginAllowed(undefined)).toBe(true);
        });
    });

    it('allows local and private-network origins outside production', () => {
        process.env.NODE_ENV = 'development';
        expect(isOriginAllowed('http://localhost:4000')).toBe(true);
        expect(isOriginAllowed('http://192.168.0.12:3000')).toBe(true);
        expect(isOriginAllowed('https://evil.net')).toBe(false);
    });
});
