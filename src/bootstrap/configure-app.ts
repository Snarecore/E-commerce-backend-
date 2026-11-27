import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { Request } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { CONFIG } from '../utils/config';
import { corsOriginCallback } from '../utils/cors-origins.util';

type RawBodyRequest = Request & { rawBody?: Buffer };

const keepRawBody = (req: RawBodyRequest, _res: unknown, buf: Buffer): void => {
    req.rawBody = buf;
};

/**
 * HTTP pipeline shared by every entry point (PM2 server in main.ts and the Vercel handler
 * in api/index.ts). Keeping it in one place stops the entry points from drifting apart —
 * the Vercel handler once carried its own, looser CORS rule.
 */
export function configureApp(app: INestApplication): void {
    // Number of reverse proxies in front of Node (nginx, Cloudflare, Vercel). req.ip — and so
    // rate limits, audit logs and IP blacklists — trusts exactly this many X-Forwarded-For hops.
    // Set TRUST_PROXY_HOPS=0 when Node is exposed directly, or clients can spoof their IP.
    const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            contentSecurityPolicy: false, // Managed at gateway/CDN level or customized as needed
        })
    );
    app.use(compression());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.enableCors({
        credentials: true,
        // Exact-match allow-list shared with the WebSocket gateway
        origin: corsOriginCallback,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    });

    // 🛡️ Body-size guard for the SSLCommerz IPN (10 KB max), mounted BEFORE the generic
    // parser so oversized streams are aborted before buffering
    const ipnRoutePath = `/${CONFIG.API}/v${CONFIG.API_VERSION}/payments/sslcommerz/ipn`;
    app.use(
        ipnRoutePath,
        express.urlencoded({ limit: '10kb', extended: false, verify: keepRawBody })
    );
    app.use(ipnRoutePath, express.json({ limit: '10kb', verify: keepRawBody }));

    // Files arrive as multipart (capped per route by common/upload/upload.policy.ts), so JSON and
    // form bodies only carry data. Small caps keep one request from stalling the single process.
    app.use(express.json({ limit: '5mb', verify: keepRawBody }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));
    app.use(cookieParser());
    app.setGlobalPrefix(CONFIG.API, { exclude: ['/', 'health', 'health/live', 'health/ready'] });
    app.enableVersioning({ type: VersioningType.URI });
}
