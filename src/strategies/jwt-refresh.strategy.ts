import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'src/common/types';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request): string | null => {
                    const token = req?.cookies?.['refreshToken'] as string;
                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: 'your_access_token_secret',
        });
    }

    validate(payload: JwtPayload): { userId: string; email: string; roles: string; name: string } {
        return { userId: payload.sub, email: payload.email, roles: payload.role, name: payload.name };
    }
}
