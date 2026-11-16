import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from './auth-session.service';
import { AuthSession } from './auth-session.entity';
import { AuthTokenType } from './auth-token.types';
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
	const loadUser = async () => user;

	beforeEach(() => {
		store = createStore();
		service = new AuthSessionService(store.repo as any, store.dataSource as any, jwt, config);
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
});

describe('JWT strategies accept exactly one token type', () => {
	const config = { get: () => ACCESS_SECRET } as unknown as ConfigService;
	const payload = { sub: 'user-1', email: 'a@b.com', role: 'customer', name: 'A' };

	it('access strategy rejects refresh, socket and untyped tokens', async () => {
		const strategy = new JwtStrategy(config);
		for (const type of [AuthTokenType.REFRESH, AuthTokenType.SOCKET, undefined]) {
			await expect(strategy.validate({ ...payload, type })).rejects.toThrow(UnauthorizedException);
		}
		await expect(strategy.validate({ ...payload, type: AuthTokenType.ACCESS })).resolves.toMatchObject({ id: 'user-1' });
	});

	it('refresh strategy rejects access and socket tokens', () => {
		const strategy = new JwtRefreshStrategy(config);
		for (const type of [AuthTokenType.ACCESS, AuthTokenType.SOCKET]) {
			expect(() => strategy.validate({ ...payload, jti: 's1', type })).toThrow(UnauthorizedException);
		}
		expect(strategy.validate({ ...payload, jti: 's1', type: AuthTokenType.REFRESH })).toEqual({ id: 'user-1', sessionId: 's1' });
	});
});
