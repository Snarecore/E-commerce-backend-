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

	protected async getTracker(req: Record<string, any>): Promise<string> {
		const rawIp = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
		const ip = Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1');
		return ip;
	}
}

