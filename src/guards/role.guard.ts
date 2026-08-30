import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';

import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request.');
    }

    const userRole = typeof user.role === 'string' ? user.role.toLowerCase().trim() : user.role;
    const hasRole = requiredRoles.some((r) =>
      typeof r === 'string' ? r.toLowerCase() === userRole : r === userRole,
    );

    if (!hasRole) {
      throw new ForbiddenException('Access denied. Insufficient role.');
    }

    return true;
  }
}
