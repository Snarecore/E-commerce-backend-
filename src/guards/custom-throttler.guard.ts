import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!(this as any).throttlers) {
			await this.onModuleInit();
		}
		return super.canActivate(context);
	}
}
