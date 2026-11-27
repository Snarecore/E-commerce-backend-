import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
    AccessTokenPayload,
    AuthTokenType,
    getAccessTokenSecret,
} from '../module/auth/session/auth-token.types';
import { SessionStatusCache } from '../module/auth/session/session-status.cache';
import { COOKIE_NAMES } from '../utils/cookie-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly sessionStatusCache: SessionStatusCache
    ) {
        const secret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is missing');
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: Request): string | null => {
                    if (!req?.cookies) return null;
                    const token =
                        req.cookies[COOKIE_NAMES.ADMIN_ACCESS] ||
                        req.cookies[COOKIE_NAMES.CUSTOMER_ACCESS];
                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: getAccessTokenSecret((key) => configService.get<string>(key)),
        });
    }

    /**
     * Runs after signature and expiry checks. Only access tokens may authenticate API calls,
     * and only while their login session is live, so logout and password reset take effect
     * immediately instead of when the 2h access token expires.
     */
    async validate(payload: Partial<Omit<AccessTokenPayload, 'type'>> & { type?: string }) {
        if (payload?.type !== AuthTokenType.ACCESS) {
            throw new UnauthorizedException('Invalid token type.');
        }
        if (!payload.sub || !payload.sid) {
            throw new UnauthorizedException('Invalid access token.');
        }
        if (!(await this.sessionStatusCache.isActive(payload.sid, payload.sub))) {
            throw new UnauthorizedException('Session has ended. Please sign in again.');
        }
        return {
            id: payload.sub,
            email: payload.email,
            role: (payload.role || 'customer').toString().toLowerCase(),
            name: payload.name,
            sessionId: payload.sid,
        };
    }
}
