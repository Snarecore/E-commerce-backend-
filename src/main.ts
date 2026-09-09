import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { CONFIG } from './utils/config';
import bodyParser from 'body-parser';
import compression from 'compression';

import { DataSource } from 'typeorm';
import { validateServerMaxConnections } from './configs/typeorm.config';

async function bootstrap(): Promise<void> {
	dotenv.config();
	const isProd = process.env.NODE_ENV === 'production';
	const app = await NestFactory.create(AppModule, {
		rawBody: true,
		logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose']
	});
	app.getHttpAdapter().getInstance().set('trust proxy', 1);
	app.use(compression());
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
	const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'];
	const allowedOrigins = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(',').map((url) => url.trim())
		: defaultOrigins;

	app.enableCors({
		credentials: true,
		origin: (origin, callback) => {
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
			limit: '50mb',
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
	app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
	app.use(cookieParser());
	app.setGlobalPrefix(CONFIG.API, { exclude: ['/'] });
    app.enableVersioning({
        type: VersioningType.URI
    });
	app.enableShutdownHooks();

	try {
		const ds = app.get(DataSource);
		await validateServerMaxConnections(ds);
	} catch (e: any) {
		console.warn(`[DB Budget Check Note] ${e.message}`);
	}

	const server = await app.listen(process.env.PORT ?? 5000);
	if (server && 'keepAliveTimeout' in server) {
		server.keepAliveTimeout = 65000;
		server.headersTimeout = 66000;
	}
}
bootstrap();
