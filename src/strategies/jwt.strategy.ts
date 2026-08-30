// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { PassportStrategy } from '@nestjs/passport';
// import { JwtPayload } from 'jsonwebtoken';
// import { ExtractJwt, Strategy } from 'passport-jwt';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
//   constructor(configService: ConfigService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       secretOrKey: configService.get<string>('JWT_SECRET', ''),
//     });
//   }

//   validate(payload: { sub: string; email: string; roles: string }): JwtPayload {
//     return { userId: payload.sub, email: payload.email, roles: payload.roles };
//   }
// }

// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { ConfigService } from '@nestjs/config';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { User } from '../module/user/entities/user.entity';
// import { UserRepository } from '../module/user/user.repository';
// import { JwtPayload } from 'jsonwebtoken';
// import { Role } from '../enums/role.enum';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
//   constructor(
//     private configService: ConfigService,
//     @InjectRepository(User)
//     private readonly userRepository: UserRepository,

//   ) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       secretOrKey: configService.get<string>('JWT_SECRET', ''),
//     });
//   }

//   validate(payload: { sub: string; email: string; roles: Role }): JwtPayload {
//     return { userId: payload.sub, email: payload.email, roles: payload.roles };
//   }
// }

// jwt.strategy.ts
// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { Request } from 'express';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
// 	constructor() {
// 		super({
// 			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
// 			ignoreExpiration: false,
// 			secretOrKey: '0c1b10e6e5375d9a6fcd5cbf764f7ae83f9a6b91d0b77127c553b0aef4647d89', // should match what's used to sign JWTs
// 		});
// 	}

// 	async validate(payload: any) {
// 		// Attach user info to request
// 		return { userId: payload.sub, email: payload.email, role: payload.roles };
// 	}
// }

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/types';
import { Request } from 'express';
import { COOKIE_NAMES } from '../utils/cookie-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
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
            secretOrKey: process.env.JWT_SECRET || '0c1b10e6e5375d9a6fcd5cbf764f7ae83f9a6b91d0b77127c553b0aef4647d89',
        });
    }

    async validate(payload: JwtPayload) {
        return { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    }
}

