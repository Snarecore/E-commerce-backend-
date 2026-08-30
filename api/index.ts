import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import express from 'express';
import { AppModule } from '../src/app.module';
import { CONFIG } from '../src/utils/config';

dotenv.config();

const server = express();

let app: any;

async function bootstrap() {
	if (!app) {
		app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });
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
					/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
				) {
					callback(null, true);
				} else {
					callback(null, false);
				}
			},
			methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		});
		app.use(
			bodyParser.json({
				limit: '5mb',
				verify: (req: any, _res, buf) => {
					req.rawBody = buf;
				},
			}),
		);
		app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
		app.use(cookieParser());
		app.setGlobalPrefix(CONFIG.API, { exclude: ['/'] });
		app.enableVersioning({
			type: VersioningType.URI,
		});
		await app.init();
	}
	return app;
}

export default async function handler(req: any, res: any) {
	await bootstrap();
	server(req, res);
}
