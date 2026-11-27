import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from './auth-session.service';
import { AuthSession } from './auth-session.entity';
import { AuthTokenType } from './auth-token.types';
import { SessionStatusCache } from './session-status.cache';
import { JwtStrategy } from '../../../strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../../../strategies/jwt-refresh.strategy';

const ACCESS_SECRET = 'a'.repeat(40);
const REFRESH_SECRET = 'r'.repeat(40);
const user = { id: 'user-1', email: 'a@b.com', role: 'customer', name: 'A' };

/** In-memory stand-in for the auth_sessions table. */
const createStore = () => {
	const rows = new Map<string, any>();
	const matches = (row: any, where: any) =>
		Object.entries(where).every(([k, v]) => (v && typeof v === 'object' ? (row as any)[k] == null : (row as any)[k] === v));
	const repo = {
		create: (data: Partial<AuthSession>) => ({ ...data }) as AuthSession,
		save: async (row: any) => {
			rows.set(row.id, { ...row });
			return row;
		},
		findOne: async ({ where }: any) => {
			const row = rows.get(where.id);
			return row ? { ...row } : null;
		},
		update: async (where: any, patch: any) => {
			rows.forEach((row, id) => matches(row, where) && rows.set(id, { ...row, ...patch }));
		},
	};
	const dataSource = { transaction: (fn: any) => fn({ getRepository: () => repo }) };
	return { rows, repo, dataSource };
};

describe('AuthSessionService', () => {
	const config = { get: (key: string) => ({ JWT_SECRET: ACCESS_SECRET, JWT_REFRESH_SECRET: REFRESH_SECRET })[key] } as ConfigService;
	const jwt = new JwtService({});
	let store: ReturnType<typeof createStore>;
	let service: AuthSessionService;
	let events: { emit: jest.Mock };
	const loadUser = async () => user;

	beforeEach(() => {
		store = createStore();
		events = { emit: jest.fn() };
		service = new AuthSessionService(store.repo as any, store.dataSource as any, jwt, config, events as any);
	});

	it('issues typed tokens signed with separate secrets and stores only a hash', async () => {
		const { accessToken, refreshToken } = await service.createSession(user);
		const access = jwt.verify(accessToken, { secret: ACCESS_SECRET });
		const refresh = jwt.verify(refreshToken, { secret: REFRESH_SECRET });

		expect(access).toMatchObject({ sub: 'user-1', type: AuthTokenType.ACCESS, sid: refresh.jti });
		expect(refresh).toMatchObject({ sub: 'user-1', type: AuthTokenType.REFRESH });
		expect(() => jwt.verify(refreshToken, { secret: ACCESS_SECRET })).toThrow();
		const [row] = [...store.rows.values()];
		expect(row.tokenHash).toHaveLength(64);
		expect(row.tokenHash).not.toContain(refreshToken);
	});

	it('rejects unsigned, forged and wrong-type refresh tokens instead of decoding them', async () => {
		const forged = jwt.sign({ sub: 'admin-1', type: AuthTokenType.REFRESH }, { secret: 'attacker', jwtid: 'x' });
		const accessAsRefresh = jwt.sign({ sub: 'user-1', type: AuthTokenType.ACCESS }, { secret: REFRESH_SECRET, jwtid: 'x' });

		await expect(service.rotateSession(forged, loadUser)).rejects.toThrow(UnauthorizedException);
		await expect(service.rotateSession(accessAsRefresh, loadUser)).rejects.toThrow(UnauthorizedException);
		await expect(service.rotateSession('not.a.jwt', loadUser)).rejects.toThrow(UnauthorizedException);
	});

	it('rotates the refresh token and revokes the old session', async () => {
		const first = await service.createSession(user);
		const result = await service.rotateSession(first.refreshToken, loadUser);

		expect(result.kind).toBe('rotated');
		const oldId = jwt.decode(first.refreshToken).jti;
		expect(store.rows.get(oldId)).toMatchObject({ revokedReason: 'rotated' });
	});

	it('treats an immediate second use as a benign race and returns only an access token', async () => {
		const first = await service.createSession(user);
		await service.rotateSession(first.refreshToken, loadUser);

		const again = await service.rotateSession(first.refreshToken, loadUser);
		expect(again.kind).toBe('grace');
	});

	it('revokes every session of the user when a rotated token is reused later', async () => {
		const first = await service.createSession(user);
		const other = await service.createSession(user);
		await service.rotateSession(first.refreshToken, loadUser);
		const oldId = jwt.decode(first.refreshToken).jti;
		store.rows.get(oldId)!.revokedAt = new Date(Date.now() - 60_000);

		await expect(service.rotateSession(first.refreshToken, loadUser)).rejects.toThrow('already been used');
		await expect(service.rotateSession(other.refreshToken, loadUser)).rejects.toThrow(UnauthorizedException);
		expect([...store.rows.values()].every((row) => row.revokedAt)).toBe(true);
	});

	it('rejects a refresh token after logout', async () => {
		const { refreshToken } = await service.createSession(user);
		await service.revokeByRefreshToken(refreshToken);
		await expect(service.rotateSession(refreshToken, loadUser)).rejects.toThrow(UnauthorizedException);
	});

	describe('isSessionActive', () => {
		const sidOf = (accessToken: string) => (jwt.verify(accessToken, { secret: ACCESS_SECRET }) as any).sid as string;

		it('is true for a live session and false for another user', async () => {
			const { accessToken } = await service.createSession(user);
			await expect(service.isSessionActive(sidOf(accessToken), user.id)).resolves.toBe(true);
			await expect(service.isSessionActive(sidOf(accessToken), 'someone-else')).resolves.toBe(false);
			await expect(service.isSessionActive('missing', user.id)).resolves.toBe(false);
		});

		it('follows rotation to the live head, and fails once the head is logged out', async () => {
			const { accessToken, refreshToken } = await service.createSession(user);
			const oldSid = sidOf(accessToken);
			const rotated = await service.rotateSession(refreshToken, loadUser);
			if (rotated.kind !== 'rotated') throw new Error('expected rotation');

			await expect(service.isSessionActive(oldSid, user.id)).resolves.toBe(true);

			await service.revokeByRefreshToken(rotated.tokens.refreshToken);
			await expect(service.isSessionActive(oldSid, user.id)).resolves.toBe(false);
		});

		it('is false after all sessions are revoked', async () => {
			const { accessToken } = await service.createSession(user);
			await service.revokeAllForUser(user.id, 'password_reset');
			await expect(service.isSessionActive(sidOf(accessToken), user.id)).resolves.toBe(false);
		});
	});

	it('publishes a revoked event on logout and on revoke-all', async () => {
		const { refreshToken } = await service.createSession(user);
		await service.revokeByRefreshToken(refreshToken);
		await service.revokeAllForUser(user.id, 'password_reset');
		expect(events.emit).toHaveBeenCalledWith('auth.session.revoked', expect.objectContaining({ userId: user.id, reason: 'logout' }));
		expect(events.emit).toHaveBeenCalledWith('auth.session.revoked', expect.objectContaining({ userId: user.id, reason: 'password_reset' }));
	});

	it('binds socket tokens to the login session', async () => {
		const token = service.signSocketToken(user, 'session-1');
		expect(jwt.verify(token, { secret: ACCESS_SECRET })).toMatchObject({ sub: user.id, sid: 'session-1', type: AuthTokenType.SOCKET });
	});
});

describe('JWT strategies accept exactly one token type', () => {
	const config = { get: () => ACCESS_SECRET } as unknown as ConfigService;
	const payload = { sub: 'user-1', email: 'a@b.com', role: 'customer', name: 'A' };

	const liveSessions = { isActive: jest.fn().mockResolvedValue(true) } as unknown as SessionStatusCache;

	it('access strategy rejects refresh, socket and untyped tokens', async () => {
		const strategy = new JwtStrategy(config, liveSessions);
		for (const type of [AuthTokenType.REFRESH, AuthTokenType.SOCKET, undefined]) {
			await expect(strategy.validate({ ...payload, sid: 's1', type })).rejects.toThrow(UnauthorizedException);
		}
		await expect(strategy.validate({ ...payload, sid: 's1', type: AuthTokenType.ACCESS })).resolves.toMatchObject({
			id: 'user-1',
			sessionId: 's1',
		});
	});

	it('access strategy rejects tokens without a session and tokens of an ended session', async () => {
		const ended = { isActive: jest.fn().mockResolvedValue(false) } as unknown as SessionStatusCache;
		await expect(new JwtStrategy(config, liveSessions).validate({ ...payload, type: AuthTokenType.ACCESS })).rejects.toThrow(
			UnauthorizedException,
		);
		await expect(new JwtStrategy(config, ended).validate({ ...payload, sid: 's1', type: AuthTokenType.ACCESS })).rejects.toThrow(
			UnauthorizedException,
		);
	});

	it('refresh strategy rejects access and socket tokens', () => {
		const strategy = new JwtRefreshStrategy(config);
		for (const type of [AuthTokenType.ACCESS, AuthTokenType.SOCKET]) {
			expect(() => strategy.validate({ ...payload, jti: 's1', type })).toThrow(UnauthorizedException);
		}
		expect(strategy.validate({ ...payload, jti: 's1', type: AuthTokenType.REFRESH })).toEqual({ id: 'user-1', sessionId: 's1' });
	});
});

describe('SessionStatusCache', () => {
	it('caches lookups and forgets a user as soon as their session is revoked', async () => {
		const sessions = { isSessionActive: jest.fn().mockResolvedValue(true) };
		const cache = new SessionStatusCache(sessions as unknown as AuthSessionService);

		await expect(cache.isActive('s1', 'user-1')).resolves.toBe(true);
		await expect(cache.isActive('s1', 'user-1')).resolves.toBe(true);
		expect(sessions.isSessionActive).toHaveBeenCalledTimes(1);

		sessions.isSessionActive.mockResolvedValue(false);
		cache.handleSessionRevoked({ userId: 'user-1', reason: 'logout' });
		await expect(cache.isActive('s1', 'user-1')).resolves.toBe(false);
		expect(sessions.isSessionActive).toHaveBeenCalledTimes(2);
	});

	it('does not drop other users on revoke', async () => {
		const sessions = { isSessionActive: jest.fn().mockResolvedValue(true) };
		const cache = new SessionStatusCache(sessions as unknown as AuthSessionService);
		await cache.isActive('s2', 'user-2');
		cache.handleSessionRevoked({ userId: 'user-1', reason: 'logout' });
		await cache.isActive('s2', 'user-2');
		expect(sessions.isSessionActive).toHaveBeenCalledTimes(1);
	});
});
