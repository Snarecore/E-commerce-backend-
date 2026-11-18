import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/role.decorator';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './role.guard';

function contextFor(metadata: Record<string, unknown>, user?: { role: string }): ExecutionContext {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_KEY, metadata[IS_PUBLIC_KEY], handler);
    Reflect.defineMetadata(ROLES_KEY, metadata[ROLES_KEY], handler);
    return {
        getHandler: () => handler,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());

    it('denies a protected route that declares no roles', () => {
        const ctx = contextFor({}, { role: 'admin' });
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('allows a @Public route without a user', () => {
        const ctx = contextFor({ [IS_PUBLIC_KEY]: true });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('lets a customer through a customer route', () => {
        const ctx = contextFor({ [ROLES_KEY]: [Role.CUSTOMER] }, { role: 'customer' });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('lets an admin through a customer route via the hierarchy', () => {
        const ctx = contextFor({ [ROLES_KEY]: [Role.CUSTOMER] }, { role: 'admin' });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('blocks a customer from an admin route', () => {
        const ctx = contextFor({ [ROLES_KEY]: [Role.ADMIN] }, { role: 'customer' });
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('blocks a role-protected route when no user is attached', () => {
        const ctx = contextFor({ [ROLES_KEY]: [Role.CUSTOMER] });
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
});
