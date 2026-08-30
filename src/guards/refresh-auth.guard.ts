import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { User } from '../module/user/entities/user.entity';

@Injectable()
export class RefreshAuthGuard extends AuthGuard('jwt-refresh') {
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        return super.canActivate(context);
    }

    handleRequest<TUser = User>(err: Error | null, user: TUser | null): TUser {
        if (err || !user) {
            throw new UnauthorizedException('Unauthorized access.');
        }
        return user;
    }
}
