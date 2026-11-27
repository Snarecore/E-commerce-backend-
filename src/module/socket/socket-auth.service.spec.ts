import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { SocketAuthService } from './socket-auth.service';
import { SocketSessionListener } from './socket-session.listener';
import { SocketService } from './socket.service';
import { Role } from '../../enums/role.enum';
import { COOKIE_NAMES } from '../../utils/cookie-config';
import { AuthSessionService } from '../auth/session/auth-session.service';
import { AuthTokenType } from '../auth/session/auth-token.types';
import { ConversationRepository } from '../chat/conversation/conversation.repository';

const SECRET = 's'.repeat(40);
const ADMIN_ORIGIN = 'https://admin.shop.test';

const jwt = new JwtService({});
const sign = (claims: Record<string, unknown>, secret = SECRET) =>
    jwt.sign(
        {
            sub: 'user-1',
            email: 'a@b.com',
            name: 'A',
            role: 'customer',
            sid: 'sess-1',
            type: AuthTokenType.ACCESS,
            ...claims,
        },
        { secret, expiresIn: '5m' }
    );

const socketWith = (handshake: {
    auth?: Record<string, unknown>;
    headers?: Record<string, string>;
}) => ({ id: 'sock-1', handshake: { auth: {}, headers: {}, ...handshake } }) as unknown as Socket;

describe('SocketAuthService', () => {
    const config = {
        get: (key: string) => ({ JWT_SECRET: SECRET, ADMIN_URL: ADMIN_ORIGIN })[key],
    } as unknown as ConfigService;
    let sessions: { isSessionActive: jest.Mock };
    let conversations: { findOne: jest.Mock };
    let service: SocketAuthService;

    beforeEach(() => {
        sessions = { isSessionActive: jest.fn().mockResolvedValue(true) };
        conversations = { findOne: jest.fn() };
        service = new SocketAuthService(
            jwt,
            config,
            sessions as unknown as AuthSessionService,
            conversations as unknown as ConversationRepository
        );
    });

    it('authenticates an access token from the cookie and binds the session', async () => {
        const token = sign({});
        const user = await service.authenticateSocket(
            socketWith({ headers: { cookie: `${COOKIE_NAMES.CUSTOMER_ACCESS}=${token}` } })
        );
        expect(user).toEqual({
            id: 'user-1',
            email: 'a@b.com',
            name: 'A',
            role: Role.CUSTOMER,
            sessionId: 'sess-1',
        });
        expect(sessions.isSessionActive).toHaveBeenCalledWith('sess-1', 'user-1');
    });

    it('rejects refresh tokens, tokens without sid, bad signatures and revoked sessions', async () => {
        const cases = [
            sign({ type: AuthTokenType.REFRESH }),
            sign({ sid: undefined }),
            sign({}, 'x'.repeat(40)),
        ];
        for (const token of cases) {
            await expect(
                service.authenticateSocket(socketWith({ auth: { token } }))
            ).resolves.toBeNull();
        }
        sessions.isSessionActive.mockResolvedValue(false);
        await expect(
            service.authenticateSocket(socketWith({ auth: { token: sign({}) } }))
        ).resolves.toBeNull();
    });

    it('fails closed when the session store throws', async () => {
        sessions.isSessionActive.mockRejectedValue(new Error('db down'));
        await expect(
            service.authenticateSocket(socketWith({ auth: { token: sign({}) } }))
        ).resolves.toBeNull();
    });

    it('prefers an explicit handshake token over cookies', async () => {
        const cookie = `${COOKIE_NAMES.ADMIN_ACCESS}=${sign({ role: 'admin', sub: 'admin-1' })}`;
        const user = await service.authenticateSocket(
            socketWith({
                auth: { token: `Bearer ${sign({ type: AuthTokenType.SOCKET })}` },
                headers: { cookie },
            })
        );
        expect(user).toMatchObject({ id: 'user-1', role: Role.CUSTOMER });
    });

    describe('when both admin and customer cookies are present', () => {
        const cookie = [
            `${COOKIE_NAMES.ADMIN_ACCESS}=${sign({ role: 'admin', sub: 'admin-1' })}`,
            `${COOKIE_NAMES.CUSTOMER_ACCESS}=${sign({})}`,
        ].join('; ');

        it('uses the customer identity by default (least privilege)', async () => {
            const user = await service.authenticateSocket(
                socketWith({ headers: { cookie, origin: 'https://shop.test' } })
            );
            expect(user).toMatchObject({ id: 'user-1', role: Role.CUSTOMER });
        });

        it('uses the admin identity for the admin origin or an explicit admin scope', async () => {
            const fromOrigin = await service.authenticateSocket(
                socketWith({ headers: { cookie, origin: `${ADMIN_ORIGIN}/` } })
            );
            const fromScope = await service.authenticateSocket(
                socketWith({ auth: { scope: 'admin' }, headers: { cookie } })
            );
            expect(fromOrigin).toMatchObject({ id: 'admin-1', role: Role.ADMIN });
            expect(fromScope).toMatchObject({ id: 'admin-1', role: Role.ADMIN });
        });
    });

    describe('verifyConversationAccess', () => {
        const customer = { id: 'user-1', email: '', name: '', role: Role.CUSTOMER, sessionId: 's' };

        it('allows only the owning customer on a live conversation', async () => {
            conversations.findOne.mockResolvedValueOnce({ customerId: 'user-1', isDeleted: false });
            await expect(service.verifyConversationAccess(customer, 'c1')).resolves.toBe(true);
            conversations.findOne.mockResolvedValueOnce({ customerId: 'other', isDeleted: false });
            await expect(service.verifyConversationAccess(customer, 'c1')).resolves.toBe(false);
            conversations.findOne.mockResolvedValueOnce({ customerId: 'user-1', isDeleted: true });
            await expect(service.verifyConversationAccess(customer, 'c1')).resolves.toBe(false);
        });

        it('allows admins without a lookup', async () => {
            await expect(
                service.verifyConversationAccess({ ...customer, role: Role.ADMIN }, 'c1')
            ).resolves.toBe(true);
            expect(conversations.findOne).not.toHaveBeenCalled();
        });
    });
});

describe('SocketSessionListener', () => {
    it('disconnects only the sockets whose session is no longer active', async () => {
        const live = {
            id: 'a',
            data: { user: { id: 'u', sessionId: 'live' } },
            disconnect: jest.fn(),
        };
        const dead = {
            id: 'b',
            data: { user: { id: 'u', sessionId: 'dead' } },
            disconnect: jest.fn(),
        };
        const socketService = { fetchUserSockets: jest.fn().mockResolvedValue([live, dead]) };
        const socketAuth = {
            isSessionActive: jest.fn((sid: string) => Promise.resolve(sid === 'live')),
        };
        const listener = new SocketSessionListener(
            socketService as unknown as SocketService,
            socketAuth as unknown as SocketAuthService
        );

        await listener.handleSessionRevoked({ userId: 'u', reason: 'logout' });

        expect(socketService.fetchUserSockets).toHaveBeenCalledWith('u');
        expect(live.disconnect).not.toHaveBeenCalled();
        expect(dead.disconnect).toHaveBeenCalledWith(true);
    });
});
