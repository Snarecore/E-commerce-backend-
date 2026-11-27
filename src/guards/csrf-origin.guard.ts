import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { COOKIE_NAMES } from '../utils/cookie-config';
import { isOriginAllowed, normalizeOrigin } from '../utils/cors-origins.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const AUTH_COOKIES = [COOKIE_NAMES.ADMIN_ACCESS, COOKIE_NAMES.CUSTOMER_ACCESS];

/**
 * CSRF defence for cookie-authenticated requests (OWASP "verify origin with standard headers").
 *
 * Auth cookies are `SameSite=None` in production (the storefront and admin live on other
 * sites), so the browser attaches them to requests forged by any page. CORS does not stop
 * that: a cross-site HTML form POST is sent without a preflight. So every state-changing
 * request that is authenticated by cookie must come from an allowed Origin (or Referer).
 *
 * Not affected: safe methods, @Public routes (webhooks, payment gateway callbacks, login),
 * and requests authenticated by an `Authorization: Bearer` header, which a forged
 * cross-site request cannot set.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
	private readonly logger = new Logger(CsrfOriginGuard.name);

	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		if (context.getType() !== 'http') return true;

		const req = context.switchToHttp().getRequest<Request>();
		if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (isPublic) return true;

		if (!this.isCookieAuthenticated(req)) return true;

		const origin = this.requestOrigin(req);
		if (origin && isOriginAllowed(origin)) return true;

		this.logger.warn(`Blocked cross-site ${req.method} ${req.originalUrl} from origin "${origin ?? 'none'}"`);
		throw new ForbiddenException('Cross-site request blocked.');
	}

	/** Bearer header wins over cookies in JwtStrategy, so only cookie-only requests are CSRF-able. */
	private isCookieAuthenticated(req: Request): boolean {
		if (typeof req.headers.authorization === 'string' && /^Bearer\s+\S+/i.test(req.headers.authorization)) {
			return false;
		}
		const cookies = (req.cookies ?? {}) as Record<string, unknown>;
		return AUTH_COOKIES.some((name) => typeof cookies[name] === 'string' && cookies[name] !== '');
	}

	/** Origin header, else the origin part of Referer. Null when the browser sent neither. */
	private requestOrigin(req: Request): string | null {
		const origin = req.headers.origin;
		if (typeof origin === 'string' && origin && origin !== 'null') return normalizeOrigin(origin);

		const referer = req.headers.referer;
		if (typeof referer === 'string' && referer) {
			try {
				return normalizeOrigin(new URL(referer).origin);
			} catch {
				return null;
			}
		}
		return null;
	}
}
