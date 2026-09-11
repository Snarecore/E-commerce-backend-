import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

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
