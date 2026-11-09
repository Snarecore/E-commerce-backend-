import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { CONFIG } from '../src/utils/config';

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

			app.getHttpAdapter().getInstance().set('trust proxy', 1);
			app.use(
				helmet({
					crossOriginResourcePolicy: { policy: 'cross-origin' },
					contentSecurityPolicy: false,
				})
			);
			app.use(compression());
			app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

			const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'];
			const allowedOrigins = process.env.ALLOWED_ORIGINS
				? process.env.ALLOWED_ORIGINS.split(',').map((url) => url.trim())
				: defaultOrigins;

			app.enableCors({
				credentials: true,
				origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
					if (
						!origin ||
						allowedOrigins.includes(origin) ||
						/\.vercel\.app$/.test(origin) ||
						(!isProd && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)))
					) {
						callback(null, true);
					} else {
						callback(null, false);
					}
				},
				methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
			});

			// 🛡️ Physical Body-Size Stream Abort Guard for SSLCommerz IPN (10 KB Max Stream)
			const ipnRoutePath = `/${CONFIG.API}/v${CONFIG.API_VERSION}/payments/sslcommerz/ipn`;
			app.use(
				ipnRoutePath,
				bodyParser.urlencoded({
					limit: '10kb',
					extended: false,
					verify: (req: any, _res, buf) => {
						req.rawBody = buf;
					},
				})
			);
			app.use(
				ipnRoutePath,
				bodyParser.json({
					limit: '10kb',
					verify: (req: any, _res, buf) => {
						req.rawBody = buf;
					},
				})
			);

			app.use(
				bodyParser.json({
					limit: '50mb',
					verify: (req: any, _res, buf) => {
						req.rawBody = buf;
					},
				})
			);
			app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
			app.use(cookieParser());
			app.setGlobalPrefix(CONFIG.API, { exclude: ['/', 'health', 'health/live', 'health/ready'] });
			app.enableVersioning({
				type: VersioningType.URI,
			});

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
