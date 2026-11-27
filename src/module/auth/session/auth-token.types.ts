/**
 * Every JWT this API issues carries a `type` claim, and each verifier accepts exactly
 * one type. This stops a refresh or socket token from being replayed as an access token.
 */
export enum AuthTokenType {
	ACCESS = 'access',
	REFRESH = 'refresh',
	SOCKET = 'socket',
}

export const ACCESS_TOKEN_TTL = '2h';
export const REFRESH_TOKEN_TTL = '7d';
export const SOCKET_TOKEN_TTL = '5m';

/** A just-rotated refresh token presented again within this window is treated as a
 * benign race (two tabs refreshing at once), not as token theft. */
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;

export interface AccessTokenPayload {
	sub: string;
	email: string;
	role: string;
	name: string;
	sid: string;
	type: AuthTokenType.ACCESS;
}

export interface SocketTokenPayload {
	sub: string;
	email: string;
	role: string;
	name: string;
	sid: string;
	type: AuthTokenType.SOCKET;
}

export interface RefreshTokenPayload {
	sub: string;
	jti: string;
	type: AuthTokenType.REFRESH;
}

export interface SessionUser {
	id: string;
	email: string;
	role: string;
	name: string;
}

export interface SessionContext {
	ipAddress?: string | null;
	userAgent?: string | null;
}

export interface SessionTokens {
	accessToken: string;
	refreshToken: string;
}

export const getAccessTokenSecret = (get: (key: string) => string | undefined): string =>
	get('JWT_SECRET') || process.env.JWT_SECRET || 'dev_jwt_secret_cloth';

export const getRefreshTokenSecret = (get: (key: string) => string | undefined): string =>
	get('JWT_REFRESH_SECRET') || process.env.JWT_REFRESH_SECRET || getAccessTokenSecret(get);
