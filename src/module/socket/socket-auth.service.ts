import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { SocketAuthScope } from './socket.constants';
import { AuthenticatedSocketUser } from './socket.types';
import { Role } from '../../enums/role.enum';
import { COOKIE_NAMES } from '../../utils/cookie-config';
import { normalizeOrigin, splitList } from '../../utils/cors-origins.util';
import { AuthSessionService } from '../auth/session/auth-session.service';
import {
    AccessTokenPayload,
    AuthTokenType,
    SocketTokenPayload,
    getAccessTokenSecret,
} from '../auth/session/auth-token.types';
import { ConversationRepository } from '../chat/conversation/conversation.repository';

type Handshake = Socket['handshake'];
type HandshakeTokenPayload = Partial<Omit<AccessTokenPayload | SocketTokenPayload, 'type'>> & {
    type?: string;
};

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
const errorStack = (error: unknown): string | undefined =>
    error instanceof Error ? error.stack : undefined;

/** Token types allowed to open a socket: the access cookie, or a short-lived socket token. */
const HANDSHAKE_TOKEN_TYPES: ReadonlySet<string> = new Set([
    AuthTokenType.ACCESS,
    AuthTokenType.SOCKET,
]);

@Injectable()
export class SocketAuthService {
    private readonly logger = new Logger(SocketAuthService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly authSessionService: AuthSessionService,
        private readonly conversationRepository: ConversationRepository
    ) {}

    private get accessSecret(): string {
        // Same resolution as the signer, so HTTP login and socket handshake can never disagree
        return getAccessTokenSecret((key) => this.configService.get<string>(key));
    }

    /**
     * Resolves the handshake to a user, or null when it must be rejected.
     * Checks signature, expiry, token type and that the login session is still live.
     */
    async authenticateSocket(
        client: Pick<Socket, 'id' | 'handshake'>
    ): Promise<AuthenticatedSocketUser | null> {
        const rawToken = this.extractToken(client.handshake);
        if (!rawToken) return null;

        let payload: HandshakeTokenPayload;
        try {
            payload = this.jwtService.verify<HandshakeTokenPayload>(rawToken, {
                secret: this.accessSecret,
            });
        } catch (error: unknown) {
            this.logger.debug(`Socket handshake rejected (${client.id}): ${errorMessage(error)}`);
            return null;
        }

        const { sub: userId, sid: sessionId, type } = payload ?? {};
        if (!type || !HANDSHAKE_TOKEN_TYPES.has(type) || !userId || !sessionId) {
            return null;
        }

        const sessionActive = await this.isSessionActive(sessionId, userId);
        if (!sessionActive) {
            this.logger.debug(
                `Socket handshake rejected (${client.id}): session ${sessionId} is not active`
            );
            return null;
        }

        const role =
            String(payload.role ?? '').toLowerCase() === String(Role.ADMIN)
                ? Role.ADMIN
                : Role.CUSTOMER;
        return {
            id: userId,
            email: payload.email ?? '',
            role,
            name: payload.name ?? '',
            sessionId,
        };
    }

    /** Re-checks that a connected socket's login session has not been revoked. */
    async isSessionActive(sessionId: string, userId: string): Promise<boolean> {
        try {
            return await this.authSessionService.isSessionActive(sessionId, userId);
        } catch (error: unknown) {
            // Fail closed: if the session store is unreachable we cannot prove the session is live
            this.logger.error(
                `Session lookup failed for ${sessionId}: ${errorMessage(error)}`,
                errorStack(error)
            );
            return false;
        }
    }

    /** Customers may only access their own conversation; admins may access all of them. */
    async verifyConversationAccess(
        user: AuthenticatedSocketUser,
        conversationId: string
    ): Promise<boolean> {
        if (!user || !conversationId) return false;
        if (user.role === Role.ADMIN) return true;

        try {
            const conversation = await this.conversationRepository.findOne(conversationId);
            return !!conversation && !conversation.isDeleted && conversation.customerId === user.id;
        } catch (error: unknown) {
            this.logger.error(
                `Conversation access check failed for ${conversationId}: ${errorMessage(error)}`,
                errorStack(error)
            );
            return false;
        }
    }

    /**
     * Token precedence:
     * 1. An explicit token (`auth.token` or `Authorization` header) — the client stated its intent.
     * 2. Auth cookies. When both the admin and customer cookie are present, the requested
     *    scope decides; without one, the admin cookie is used only for the configured admin
     *    origin, otherwise the customer cookie (least privilege).
     */
    private extractToken(handshake: Handshake): string | null {
        const explicit: unknown = handshake?.auth?.token ?? handshake?.headers?.authorization;
        if (typeof explicit === 'string' && explicit.trim()) {
            return this.stripBearer(explicit);
        }

        const cookies = this.parseCookies(handshake?.headers?.cookie);
        const adminToken = cookies[COOKIE_NAMES.ADMIN_ACCESS];
        const customerToken = cookies[COOKIE_NAMES.CUSTOMER_ACCESS];

        if (adminToken && customerToken) {
            return this.resolveScope(handshake) === SocketAuthScope.ADMIN
                ? adminToken
                : customerToken;
        }
        return adminToken || customerToken || null;
    }

    private resolveScope(handshake: Handshake): SocketAuthScope {
        const requested: unknown = handshake?.auth?.scope;
        if (requested === SocketAuthScope.ADMIN || requested === SocketAuthScope.CUSTOMER) {
            return requested;
        }

        const origin = handshake?.headers?.origin;
        const adminOrigins = splitList(this.configService.get<string>('ADMIN_URL'));
        if (typeof origin === 'string' && adminOrigins.includes(normalizeOrigin(origin))) {
            return SocketAuthScope.ADMIN;
        }
        return SocketAuthScope.CUSTOMER;
    }

    private stripBearer(value: string): string {
        return value.replace(/^Bearer\s+/i, '').trim();
    }

    private parseCookies(cookieHeader: string | undefined): Record<string, string> {
        const cookies: Record<string, string> = {};
        if (!cookieHeader) return cookies;

        for (const pair of cookieHeader.split(';')) {
            const idx = pair.indexOf('=');
            if (idx <= 0) continue;
            const key = pair.substring(0, idx).trim();
            const value = pair.substring(idx + 1).trim();
            try {
                cookies[key] = decodeURIComponent(value);
            } catch {
                cookies[key] = value;
            }
        }
        return cookies;
    }
}
