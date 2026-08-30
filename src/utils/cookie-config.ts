import { Response, CookieOptions } from 'express';

export const COOKIE_NAMES = {
	CUSTOMER_ACCESS: 'cloth_customer_access',
	CUSTOMER_REFRESH: 'cloth_customer_refresh',
	ADMIN_ACCESS: 'cloth_admin_access',
	ADMIN_REFRESH: 'cloth_admin_refresh',
} as const;

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
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
