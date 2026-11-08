import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers?.authorization;

        // If no Bearer token was supplied, bypass JWT verification and permit guest evaluation
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return true;
        }

        // If a Bearer token was explicitly supplied, enforce full passport JWT validation
        return (await super.canActivate(context)) as boolean;
    }

    handleRequest(err: any, user: any, info: any) {
        if (err || info || !user) {
            throw err || new UnauthorizedException('Invalid or expired authentication credentials.');
        }
        return user;
    }
}
