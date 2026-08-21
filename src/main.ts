import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { CONFIG } from './utils/config';
import * as bodyParser from 'body-parser';

async function bootstrap(): Promise<void> {
	dotenv.config();
	const app = await NestFactory.create(AppModule, { rawBody: true });
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
	app.enableCors({
		credentials: true,
		origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
	});
	app.use(
		bodyParser.json({
			limit: '100mb',
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
    app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
	app.use(cookieParser());
	app.setGlobalPrefix(CONFIG.API);
    app.enableVersioning({
        type: VersioningType.URI
    });
	await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
