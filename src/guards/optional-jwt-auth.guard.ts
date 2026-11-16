import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { COOKIE_NAMES } from '../utils/cookie-config';

/**
 * For routes that serve both guests and signed-in users. With no credentials the request
 * continues as a guest (req.user = null). If a Bearer header or access cookie is present,
 * it is fully verified, so a forged or expired token is rejected rather than ignored.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const hasBearer = typeof req.headers?.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
        const hasAccessCookie = Boolean(req.cookies?.[COOKIE_NAMES.CUSTOMER_ACCESS] || req.cookies?.[COOKIE_NAMES.ADMIN_ACCESS]);

        if (!hasBearer && !hasAccessCookie) {
            req.user = null;
            return true;
        }

        return (await super.canActivate(context)) as boolean;
    }

    handleRequest(err: any, user: any, info: any) {
        if (err || info || !user) {
            throw err || new UnauthorizedException('Invalid or expired authentication credentials.');
        }
        return user;
    }
}
