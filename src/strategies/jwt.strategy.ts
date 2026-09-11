import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { COOKIE_NAMES } from '../utils/cookie-config';

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
                    const token = req.cookies[COOKIE_NAMES.ADMIN_ACCESS] || 
                                  req.cookies[COOKIE_NAMES.CUSTOMER_ACCESS] || 
                                  req.cookies['accessToken'];
                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: secret || 'dev_jwt_secret_cloth',
        });
    }

    async validate(payload: any) {
        return {
            id: payload.sub || payload.id || payload.userId,
            email: payload.email,
            role: (payload.role || payload.roles || 'customer').toString().toLowerCase(),
            name: payload.name
        };
    }
}


