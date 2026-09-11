import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { COOKIE_NAMES } from '../utils/cookie-config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
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
                    const token = req.cookies[COOKIE_NAMES.CUSTOMER_REFRESH] || 
                                  req.cookies[COOKIE_NAMES.ADMIN_REFRESH] || 
                                  req.cookies['refreshToken'];
                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: secret || 'dev_jwt_secret_cloth',
        });
    }

    validate(payload: any) {
        const role = (payload.role || payload.roles || 'customer').toString().toLowerCase();
        const id = payload.sub || payload.id || payload.userId;
        return { id, userId: id, email: payload.email, role, roles: role, name: payload.name };
    }
}

