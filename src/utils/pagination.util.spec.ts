import { MAX_PAGE_SIZE, resolvePagination } from './pagination.util';

describe('resolvePagination', () => {
    it('caps oversized pages and computes the offset', () => {
        expect(resolvePagination('3', '1000000')).toEqual({ page: 3, limit: MAX_PAGE_SIZE, skip: 2 * MAX_PAGE_SIZE });
    });

    it('falls back to defaults for missing, zero, negative or garbage input', () => {
        expect(resolvePagination(undefined, undefined, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
        expect(resolvePagination(-4, 0)).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(resolvePagination('abc', 'x', 15)).toEqual({ page: 1, limit: 15, skip: 0 });
    });
});
