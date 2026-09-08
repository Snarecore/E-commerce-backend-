import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/types';
import { COOKIE_NAMES } from '../utils/cookie-config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor() {
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
            secretOrKey: process.env.JWT_SECRET || '0c1b10e6e5375d9a6fcd5cbf764f7ae83f9a6b91d0b77127c553b0aef4647d89',
        });
    }

    validate(payload: any) {
        const role = (payload.role || payload.roles || 'customer').toString().toLowerCase();
        const id = payload.sub || payload.id || payload.userId;
        return { id, userId: id, email: payload.email, role, roles: role, name: payload.name };
    }
}
