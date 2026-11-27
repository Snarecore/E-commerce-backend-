import { sqlInStoreTime, storeDayBoundaryUtc, storeLocalDate } from './store-time.util';

describe('store time (Bangladesh, UTC+06:00 by default)', () => {
    const env = process.env;
    beforeEach(() => (process.env = { ...env, STORE_UTC_OFFSET: '' }));
    afterAll(() => (process.env = env));

    it('maps a business day to its UTC window', () => {
        expect(storeDayBoundaryUtc('2026-11-27', 'start')).toBe('2026-11-26 18:00:00');
        expect(storeDayBoundaryUtc('2026-11-27', 'end')).toBe('2026-11-27 17:59:59');
    });

    it('buckets a late-evening UTC order into the next local day', () => {
        expect(storeLocalDate('2026-11-26T19:30:00Z')).toBe('2026-11-27');
    });

    it('honours a valid override and ignores an invalid one', () => {
        process.env.STORE_UTC_OFFSET = '+05:30';
        expect(sqlInStoreTime('o.createdAt')).toBe("CONVERT_TZ(o.createdAt, '+00:00', '+05:30')");
        process.env.STORE_UTC_OFFSET = "+06:00'); DROP TABLE orders; --";
        expect(sqlInStoreTime('o.createdAt')).toBe("CONVERT_TZ(o.createdAt, '+00:00', '+06:00')");
    });

    it('rejects malformed dates', () => {
        expect(() => storeDayBoundaryUtc('27/11/2026', 'start')).toThrow();
    });
});
