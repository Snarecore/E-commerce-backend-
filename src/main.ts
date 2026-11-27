import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { validateServerMaxConnections } from './configs/typeorm.config';

async function bootstrap(): Promise<void> {
    dotenv.config();
    const isProd = process.env.NODE_ENV === 'production';
    const app = await NestFactory.create(AppModule, {
        rawBody: true,
        logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    configureApp(app);
    app.enableShutdownHooks();

    try {
        const ds = app.get(DataSource);
        await validateServerMaxConnections(ds);
    } catch (e: unknown) {
        console.warn(`[DB Budget Check Note] ${e instanceof Error ? e.message : String(e)}`);
    }

    const server = (await app.listen(process.env.PORT ?? 5000)) as Server;
    // Must exceed the load balancer's idle timeout so it never reuses a socket we just closed
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
}
void bootstrap();
