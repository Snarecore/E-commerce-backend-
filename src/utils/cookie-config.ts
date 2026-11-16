import { Response, CookieOptions } from 'express';

export const COOKIE_NAMES = {
	CUSTOMER_ACCESS: 'cloth_customer_access',
	CUSTOMER_REFRESH: 'cloth_customer_refresh',
	ADMIN_ACCESS: 'cloth_admin_access',
	ADMIN_REFRESH: 'cloth_admin_refresh',
} as const;

export const ACCESS_TOKEN_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const getBaseCookieOptions = (): CookieOptions => {
	const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
	const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || (isProduction ? 'none' : 'lax');
	const secure = process.env.COOKIE_SECURE === 'true' || isProduction || sameSite === 'none';

	return {
		httpOnly: true,
		secure,
		sameSite,
		domain: process.env.COOKIE_DOMAIN || undefined,
		path: '/',
	};
};

export const setAuthCookie = (res: Response, name: string, token: string, maxAge: number): void => {
	res.cookie(name, token, {
		...getBaseCookieOptions(),
		maxAge,
	});
};

export const clearAuthCookie = (res: Response, name: string): void => {
	res.clearCookie(name, getBaseCookieOptions());
};

// Cookie names older builds wrote; still cleared on logout so stale copies do not linger
const LEGACY_COOKIE_NAMES = ['accessToken', 'refreshToken'];

export const setSessionCookies = (res: Response, role: string | undefined, tokens: { accessToken: string; refreshToken?: string }): void => {
	const isAdmin = String(role || '').toLowerCase() === 'admin';
	setAuthCookie(res, isAdmin ? COOKIE_NAMES.ADMIN_ACCESS : COOKIE_NAMES.CUSTOMER_ACCESS, tokens.accessToken, ACCESS_TOKEN_MAX_AGE);
	if (tokens.refreshToken) {
		setAuthCookie(res, isAdmin ? COOKIE_NAMES.ADMIN_REFRESH : COOKIE_NAMES.CUSTOMER_REFRESH, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE);
	}
};

export const clearSessionCookies = (res: Response): void => {
	[...Object.values(COOKIE_NAMES), ...LEGACY_COOKIE_NAMES].forEach((name) => clearAuthCookie(res, name));
};

export const readRefreshCookie = (cookies: Record<string, unknown> | undefined): string | null => {
	const token = cookies?.[COOKIE_NAMES.ADMIN_REFRESH] || cookies?.[COOKIE_NAMES.CUSTOMER_REFRESH];
	return typeof token === 'string' && token ? token : null;
};
