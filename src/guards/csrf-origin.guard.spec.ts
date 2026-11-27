import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfOriginGuard } from './csrf-origin.guard';
import { COOKIE_NAMES } from '../utils/cookie-config';

const ALLOWED = 'https://admin.shop.test';

const contextFor = (req: Record<string, unknown>): ExecutionContext =>
	({
		getType: () => 'http',
		getHandler: () => undefined,
		getClass: () => undefined,
		switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: '/x', headers: {}, cookies: {}, ...req }) }),
	}) as unknown as ExecutionContext;

describe('CsrfOriginGuard', () => {
	const env = process.env;
	let reflector: { getAllAndOverride: jest.Mock };
	let guard: CsrfOriginGuard;
	const adminCookie = { [COOKIE_NAMES.ADMIN_ACCESS]: 'jwt' };

	beforeEach(() => {
		process.env = { ...env, NODE_ENV: 'production', ALLOWED_ORIGINS: ALLOWED };
		reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
		guard = new CsrfOriginGuard(reflector as unknown as Reflector);
	});
	afterAll(() => (process.env = env));

	it('blocks a cookie-authenticated POST from another site', () => {
		const ctx = contextFor({ cookies: adminCookie, headers: { origin: 'https://evil.test' } });
		expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
	});

	it('blocks a cookie-authenticated POST that carries neither Origin nor Referer', () => {
		expect(() => guard.canActivate(contextFor({ cookies: adminCookie }))).toThrow(ForbiddenException);
	});

	it('allows the same request from an allowed Origin or Referer', () => {
		expect(guard.canActivate(contextFor({ cookies: adminCookie, headers: { origin: `${ALLOWED}/` } }))).toBe(true);
		expect(guard.canActivate(contextFor({ cookies: adminCookie, headers: { referer: `${ALLOWED}/orders/1` } }))).toBe(true);
	});

	it('ignores safe methods, @Public routes, Bearer auth and cookie-less requests', () => {
		const evil = { origin: 'https://evil.test' };
		expect(guard.canActivate(contextFor({ method: 'GET', cookies: adminCookie, headers: evil }))).toBe(true);
		expect(guard.canActivate(contextFor({ cookies: adminCookie, headers: { ...evil, authorization: 'Bearer t' } }))).toBe(true);
		expect(guard.canActivate(contextFor({ headers: evil }))).toBe(true);
		reflector.getAllAndOverride.mockReturnValue(true);
		expect(guard.canActivate(contextFor({ cookies: adminCookie, headers: evil }))).toBe(true);
	});
});
