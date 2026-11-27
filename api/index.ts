import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

dotenv.config();

const server = express();

let app: any = null;
let bootstrapPromise: Promise<any> | null = null;

async function bootstrap() {
	if (app) {
		return app;
	}
	if (bootstrapPromise) {
		return bootstrapPromise;
	}

	bootstrapPromise = (async () => {
		try {
			const isProd = process.env.NODE_ENV === 'production';
			app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
				rawBody: true,
				logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose']
			});

			configureApp(app);

			await app.init();
			return app;
		} catch (err) {
			app = null;
			bootstrapPromise = null;
			throw err;
		}
	})();

	return bootstrapPromise;
}

export default async function handler(req: any, res: any) {
	try {
		await bootstrap();
		return server(req, res);
	} catch (error: any) {
		console.error('[Vercel Handler Bootstrap Error]:', error);
		if (!res.headersSent) {
			res.status(500).json({
				statusCode: 500,
				message: 'Internal server error during application bootstrap',
				error: error?.message || 'Server failed to initialize',
			});
		}
	}
}
