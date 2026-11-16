import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { readRefreshCookie } from '../utils/cookie-config';
import { AuthTokenType, getRefreshTokenSecret } from '../module/auth/session/auth-token.types';

/**
 * Guards POST /auth/refresh-token. The refresh token is read only from its httpOnly
 * cookie and must be signed with the refresh secret and carry type=refresh.
 * Session-level checks (rotation, revocation, reuse) happen in AuthSessionService.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: (req: Request) => readRefreshCookie(req?.cookies),
            secretOrKey: getRefreshTokenSecret((key) => configService.get<string>(key)),
            passReqToCallback: false,
        });
    }

    validate(payload: any) {
        if (payload?.type !== AuthTokenType.REFRESH || !payload.jti) {
            throw new UnauthorizedException('Invalid token type.');
        }
        return { id: payload.sub, sessionId: payload.jti };
    }
}
