import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Role } from '../../enums/role.enum';
import { COOKIE_NAMES } from '../../utils/cookie-config';
import { ConversationRepository } from '../chat/conversation/conversation.repository';

import { ConfigService } from '@nestjs/config';

export interface AuthenticatedSocketUser {
    id: string;
    email: string;
    role: Role;
    name?: string;
}

@Injectable()
export class SocketAuthService {
    private readonly logger = new Logger(SocketAuthService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly conversationRepository: ConversationRepository
    ) {}

    /**
     * Extracts token from HttpOnly cookies or handshake auth payload and validates JWT.
     */
    async authenticateSocket(client: Socket): Promise<AuthenticatedSocketUser | null> {
        try {
            let rawToken: string | null = null;

            // 1. Extract from Handshake Headers Cookie
            const cookieHeader = client.handshake?.headers?.cookie;
            if (cookieHeader) {
                const parsedCookies = this.parseCookies(cookieHeader);
                rawToken = parsedCookies[COOKIE_NAMES.ADMIN_ACCESS] ||
                           parsedCookies[COOKIE_NAMES.CUSTOMER_ACCESS] ||
                           parsedCookies['accessToken'] ||
                           parsedCookies['token'] || null;
            }

            // 2. Fallback to handshake auth payload (if explicitly provided in non-cookie environments)
            if (!rawToken && client.handshake?.auth?.token) {
                rawToken = String(client.handshake.auth.token).replace(/^Bearer\s+/i, '').trim();
            }

            // 3. Fallback to authorization header
            if (!rawToken && client.handshake?.headers?.authorization) {
                rawToken = String(client.handshake.headers.authorization).replace(/^Bearer\s+/i, '').trim();
            }

            if (!rawToken) {
                return null;
            }

            rawToken = rawToken.replace(/^Bearer\s+/i, '').trim();

            const secret = this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
            if (!secret) {
                this.logger.error('JWT_SECRET environment variable is not defined.');
                return null;
            }
            const payload = this.jwtService.verify(rawToken, { secret });

            if (!payload) {
                return null;
            }

            const userId = payload.sub || payload.id || payload.userId;
            if (!userId) {
                return null;
            }

            const rawRole = (payload.role || payload.roles || Role.CUSTOMER).toString().toLowerCase();
            const role = rawRole === 'admin' ? Role.ADMIN : Role.CUSTOMER;

            return {
                id: userId,
                email: payload.email || '',
                role,
                name: payload.name || ''
            };
        } catch (error: any) {
            this.logger.debug(`Socket handshake authentication failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Zero-trust conversation authorization check.
     */
    async verifyConversationAccess(user: AuthenticatedSocketUser, conversationId: string): Promise<boolean> {
        if (!conversationId || !user) return false;

        // Admin has access to all customer conversations
        if (user.role === Role.ADMIN) return true;

        try {
            const conversation = await this.conversationRepository.findOne(conversationId);

            if (!conversation || conversation.isDeleted) return false;

            return conversation.customerId === user.id;
        } catch (e) {
            return false;
        }
    }

    private parseCookies(cookieString: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        if (!cookieString) return cookies;

        const pairs = cookieString.split(';');
        for (const pair of pairs) {
            const idx = pair.indexOf('=');
            if (idx > 0) {
                const key = pair.substring(0, idx).trim();
                const val = pair.substring(idx + 1).trim();
                try {
                    cookies[key] = decodeURIComponent(val);
                } catch {
                    cookies[key] = val;
                }
            }
        }
        return cookies;
    }
}
