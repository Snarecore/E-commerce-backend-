import { Request } from 'express';

type RequestLike = Pick<Request, 'ip' | 'socket'>;

/**
 * The one place the API decides "which IP made this request".
 *
 * Uses Express's `req.ip`, which applies the `trust proxy` setting from configure-app.ts
 * (exactly one trusted hop). Never read `X-Forwarded-For` / `X-Real-IP` yourself: those
 * headers are client-controlled, so rate limits, audit trails and IP blacklists keyed on
 * them can be spoofed by any caller.
 */
export function getClientIp(req: RequestLike | undefined | null): string | null {
	const raw = req?.ip || req?.socket?.remoteAddress;
	if (!raw) return null;
	return normalizeIp(raw);
}

/** Collapses IPv4-mapped IPv6 (`::ffff:1.2.3.4`) and IPv6 loopback to plain IPv4 forms. */
export function normalizeIp(ip: string): string {
	const trimmed = ip.trim();
	if (trimmed === '::1') return '127.0.0.1';
	return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
}
