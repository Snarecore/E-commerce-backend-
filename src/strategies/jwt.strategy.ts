import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { COOKIE_NAMES } from '../utils/cookie-config';
import { AuthTokenType, getAccessTokenSecret } from '../module/auth/session/auth-token.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is missing');
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: Request): string | null => {
                    if (!req?.cookies) return null;
                    const token = req.cookies[COOKIE_NAMES.ADMIN_ACCESS] || req.cookies[COOKIE_NAMES.CUSTOMER_ACCESS];
                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: getAccessTokenSecret((key) => configService.get<string>(key)),
        });
    }

    async validate(payload: any) {
        // Only access tokens may authenticate API calls; refresh and socket tokens are rejected
        if (payload?.type !== AuthTokenType.ACCESS) {
            throw new UnauthorizedException('Invalid token type.');
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
