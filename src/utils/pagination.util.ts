/** Largest page any list endpoint returns. Bigger requests are capped, not rejected. */
export const MAX_PAGE_SIZE = 100;

export interface ResolvedPagination {
    page: number;
    limit: number;
    skip: number;
}

/**
 * Normalises client-supplied paging values: page ≥ 1, 1 ≤ limit ≤ MAX_PAGE_SIZE, defaults for
 * missing or non-numeric input. Every list query goes through this so one request can never
 * load a whole table into memory.
 */
export function resolvePagination(page: unknown, limit: unknown, defaultLimit = 10): ResolvedPagination {
    const safePage = Math.max(1, Math.floor(Number(page)) || 1);
    const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(limit)) || defaultLimit));
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}
