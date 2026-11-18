import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/role.decorator';
import { Role } from '../enums/role.enum';

export const ROLE_HIERARCHY: Record<string, number> = {
  customer: 10,
  user: 10,
  admin: 20,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);

    // Deny by default: a protected route must say who may call it. A route that forgot
    // @Roles would otherwise be open to every logged-in customer. Use @Roles(Role.CUSTOMER)
    // for "any signed-in user" (admins pass via the hierarchy) or @Public() for no login.
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Access denied. This route declares no allowed roles.');
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request.');
    }

    const userRole = typeof user.role === 'string' ? user.role.toLowerCase().trim() : '';
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

    // Minimum required level among the specified roles for this endpoint
    const requiredLevels = requiredRoles.map((r) => {
      const roleStr = typeof r === 'string' ? r.toLowerCase().trim() : '';
      return ROLE_HIERARCHY[roleStr] ?? 999;
    });
    const minRequiredLevel = Math.min(...requiredLevels);

    // Hierarchical comparison: User Level >= Required Level
    if (userLevel < minRequiredLevel) {
      throw new ForbiddenException('Access denied. Insufficient role hierarchy.');
    }

    return true;
  }
}
