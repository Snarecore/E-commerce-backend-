import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { getClientIp } from '../utils/request-ip.util';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!(this as any).throttlers) {
			await this.onModuleInit();
		}
		return super.canActivate(context);
	}

	/**
	 * Rate-limit key = the client IP as resolved by Express.
	 *
	 * `req.ip` honours the `trust proxy` setting (configure-app.ts trusts exactly one hop),
	 * so it is the address our own reverse proxy saw. Reading `X-Forwarded-For` directly
	 * would let any client pick its own key by sending a fake header and bypass every limit.
	 */
	protected getTracker(req: Record<string, any>): Promise<string> {
		return Promise.resolve(getClientIp(req as Request) ?? 'unknown');
	}
}
