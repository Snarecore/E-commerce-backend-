import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { CONFIG } from './utils/config';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

async function bootstrap(): Promise<void> {
	dotenv.config();
	const app = await NestFactory.create(AppModule, { rawBody: true });
	app.use(compression());
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
	const allowedOrigins = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(',').map((url) => url.trim())
		: [];

	app.enableCors({
		credentials: true,
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error('CORS policy rejection: Origin not allowed'));
			}
		},
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
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
	app.setGlobalPrefix(CONFIG.API);
    app.enableVersioning({
        type: VersioningType.URI
    });
	await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
