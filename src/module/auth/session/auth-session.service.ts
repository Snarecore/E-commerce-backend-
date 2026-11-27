import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { AuthSession } from './auth-session.entity';
import { AUTH_SESSION_EVENTS, SessionRevokedEvent } from './auth-session.events';
import {
	ACCESS_TOKEN_TTL,
	AuthTokenType,
	REFRESH_REUSE_GRACE_MS,
	REFRESH_TOKEN_TTL,
	RefreshTokenPayload,
	SessionContext,
	SessionTokens,
	SessionUser,
	SOCKET_TOKEN_TTL,
	getAccessTokenSecret,
	getRefreshTokenSecret,
} from './auth-token.types';
import { REFRESH_TOKEN_MAX_AGE } from '../../../utils/cookie-config';

/** Upper bound on rotation hops followed when checking whether a session is still live. */
const MAX_ROTATION_HOPS = 10;

export type RotationResult =
	| { kind: 'rotated'; userId: string; tokens: SessionTokens }
	// Concurrent refresh with an already-rotated token: hand back an access token only
	| { kind: 'grace'; userId: string; accessToken: string };

@Injectable()
export class AuthSessionService {
	private readonly logger = new Logger(AuthSessionService.name);

	constructor(
		@InjectRepository(AuthSession) private readonly sessionRepository: Repository<AuthSession>,
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	private get accessSecret(): string {
		return getAccessTokenSecret((key) => this.configService.get<string>(key));
	}

	private get refreshSecret(): string {
		return getRefreshTokenSecret((key) => this.configService.get<string>(key));
	}

	private hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex');
	}

	private signAccessToken(user: SessionUser, sessionId: string): string {
		return this.jwtService.sign(
			{ sub: user.id, email: user.email, role: user.role, name: user.name, sid: sessionId, type: AuthTokenType.ACCESS },
			{ secret: this.accessSecret, expiresIn: ACCESS_TOKEN_TTL },
		);
	}

	private signRefreshToken(userId: string, sessionId: string): string {
		return this.jwtService.sign(
			{ sub: userId, type: AuthTokenType.REFRESH },
			{ secret: this.refreshSecret, expiresIn: REFRESH_TOKEN_TTL, jwtid: sessionId },
		);
	}

	private buildSession(userId: string, ctx: SessionContext): AuthSession {
		return this.sessionRepository.create({
			id: crypto.randomUUID(),
			userId,
			tokenHash: '',
			expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
			revokedAt: null,
			revokedReason: null,
			replacedById: null,
			ipAddress: ctx.ipAddress?.slice(0, 64) ?? null,
			userAgent: ctx.userAgent?.slice(0, 512) ?? null,
		});
	}

	/** Starts a new login session and returns its access and refresh tokens. */
	async createSession(user: SessionUser, ctx: SessionContext = {}): Promise<SessionTokens> {
		const session = this.buildSession(user.id, ctx);
		const refreshToken = this.signRefreshToken(user.id, session.id);
		session.tokenHash = this.hashToken(refreshToken);
		await this.sessionRepository.save(session);

		return { accessToken: this.signAccessToken(user, session.id), refreshToken };
	}

	/** Verifies signature, expiry and type of a refresh token. Never falls back to decode(). */
	verifyRefreshToken(token: string): RefreshTokenPayload {
		let payload: RefreshTokenPayload;
		try {
			payload = this.jwtService.verify<RefreshTokenPayload>(token, { secret: this.refreshSecret });
		} catch {
			throw new UnauthorizedException('Invalid or expired refresh token.');
		}
		if (payload?.type !== AuthTokenType.REFRESH || !payload.jti || !payload.sub) {
			throw new UnauthorizedException('Invalid refresh token.');
		}
		return payload;
	}

	/**
	 * Exchanges a refresh token for a new pair and revokes the old one (rotation).
	 * Presenting an already-rotated token outside the grace window means it was copied,
	 * so every session of that user is revoked.
	 */
	async rotateSession(
		rawRefreshToken: string,
		loadUser: (userId: string) => Promise<SessionUser | null>,
		ctx: SessionContext = {},
	): Promise<RotationResult> {
		const payload = this.verifyRefreshToken(rawRefreshToken);
		const user = await loadUser(payload.sub);
		if (!user) {
			throw new UnauthorizedException('User not found for refresh token.');
		}

		const outcome = await this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(AuthSession);
			const session = await repo.findOne({ where: { id: payload.jti }, lock: { mode: 'pessimistic_write' } });

			if (!session || session.userId !== payload.sub || session.tokenHash !== this.hashToken(rawRefreshToken)) {
				throw new UnauthorizedException('Refresh session not found.');
			}
			if (session.expiresAt.getTime() <= Date.now()) {
				throw new UnauthorizedException('Refresh session expired.');
			}

			if (session.revokedAt) {
				const rotatedRecently =
					session.revokedReason === 'rotated' && Date.now() - session.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
				if (rotatedRecently && session.replacedById) {
					return { kind: 'grace' as const, sessionId: session.replacedById };
				}
				return { kind: 'reuse' as const };
			}

			const next = this.buildSession(user.id, ctx);
			const refreshToken = this.signRefreshToken(user.id, next.id);
			next.tokenHash = this.hashToken(refreshToken);
			await repo.save(next);

			session.revokedAt = new Date();
			session.revokedReason = 'rotated';
			session.replacedById = next.id;
			await repo.save(session);

			return { kind: 'rotated' as const, sessionId: next.id, refreshToken };
		});

		if (outcome.kind === 'reuse') {
			this.logger.warn(`Refresh token reuse detected for user ${payload.sub}; revoking all sessions.`);
			await this.revokeAllForUser(payload.sub, 'reuse_detected');
			throw new UnauthorizedException('Refresh token has already been used.');
		}

		const accessToken = this.signAccessToken(user, outcome.sessionId);
		if (outcome.kind === 'grace') {
			return { kind: 'grace', userId: user.id, accessToken };
		}
		return { kind: 'rotated', userId: user.id, tokens: { accessToken, refreshToken: outcome.refreshToken } };
	}

	/** Revokes the session behind a refresh token. Unknown or invalid tokens are ignored. */
	async revokeByRefreshToken(rawRefreshToken: string | undefined | null, reason = 'logout'): Promise<void> {
		if (!rawRefreshToken) return;
		let payload: RefreshTokenPayload;
		try {
			payload = this.verifyRefreshToken(rawRefreshToken);
		} catch {
			return;
		}
		await this.sessionRepository.update(
			{ id: payload.jti, userId: payload.sub, revokedAt: IsNull() },
			{ revokedAt: new Date(), revokedReason: reason },
		);
		this.publishRevoked(payload.sub, reason);
	}

	async revokeAllForUser(userId: string, reason: string): Promise<void> {
		await this.sessionRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date(), revokedReason: reason });
		this.publishRevoked(userId, reason);
	}

	/**
	 * True while the login session behind `sessionId` is still usable by `userId`.
	 *
	 * Refresh rotation revokes a row with reason `rotated` and points `replacedById` at its
	 * successor, while access tokens minted before the rotation keep the old id. So a rotated
	 * row is followed forward until the live head is reached; any other revocation, expiry,
	 * owner mismatch or a chain longer than MAX_ROTATION_HOPS means the session is dead.
	 */
	async isSessionActive(sessionId: string, userId: string): Promise<boolean> {
		return (await this.findLiveSession(sessionId, userId)) !== null;
	}

	/** The live head of a session's rotation chain, or null when the session has ended. */
	private async findLiveSession(sessionId: string, userId: string): Promise<AuthSession | null> {
		let currentId: string | null = sessionId;
		for (let hop = 0; currentId && hop < MAX_ROTATION_HOPS; hop++) {
			const session: AuthSession | null = await this.sessionRepository.findOne({ where: { id: currentId } });
			if (!session || session.userId !== userId || session.expiresAt.getTime() <= Date.now()) {
				return null;
			}
			if (!session.revokedAt) {
				return session;
			}
			currentId = session.revokedReason === 'rotated' ? session.replacedById : null;
		}
		return null;
	}

	/**
	 * Ends every session of a user except the one making the request (e.g. after a password
	 * change: other devices are signed out, the person who changed it stays signed in).
	 */
	async revokeOtherSessions(userId: string, currentSessionId: string | null | undefined, reason: string): Promise<void> {
		const current = currentSessionId ? await this.findLiveSession(currentSessionId, userId) : null;
		const where = current ? { userId, revokedAt: IsNull(), id: Not(current.id) } : { userId, revokedAt: IsNull() };
		await this.sessionRepository.update(where, { revokedAt: new Date(), revokedReason: reason });
		this.publishRevoked(userId, reason);
	}

	/** Short-lived token the browser passes in the Socket.IO handshake. Carries `sid` so the
	 * gateway can tie the socket to the login session and drop it when that session ends. */
	signSocketToken(user: SessionUser, sessionId: string): string {
		return this.jwtService.sign(
			{ sub: user.id, email: user.email, role: user.role, name: user.name, sid: sessionId, type: AuthTokenType.SOCKET },
			{ secret: this.accessSecret, expiresIn: SOCKET_TOKEN_TTL },
		);
	}

	private publishRevoked(userId: string, reason: string): void {
		this.eventEmitter.emit(AUTH_SESSION_EVENTS.REVOKED, new SessionRevokedEvent(userId, reason));
	}
}
