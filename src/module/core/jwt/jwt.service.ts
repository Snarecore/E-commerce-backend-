import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../../common/types';

@Injectable()
export class JwtAuthService {
    constructor(private jwtService: JwtService) {}

    generateAccessToken(payload: JwtPayload): string {
        return this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: '15d',
        });
    }

    generateRefreshToken(payload: JwtPayload): string {
        return this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: '7d',
        });
    }

    verifyAccessToken(token: string): JwtPayload {
        try {
            return this.jwtService.verify<JwtPayload>(token, {
                secret: process.env.JWT_SECRET,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid token';
            throw new HttpException(errorMessage, HttpStatus.UNAUTHORIZED);
        }
    }

    verifyRefreshToken(token: string): JwtPayload {
        try {
            return this.jwtService.verify<JwtPayload>(token, {
                secret: process.env.JWT_REFRESH_SECRET,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid token';
            throw new HttpException(errorMessage, HttpStatus.UNAUTHORIZED);
        }
    }

    generateTokens(payload: JwtPayload): { accessToken: string; refreshToken: string } {
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken(payload);
        return { accessToken, refreshToken };
    }
}
