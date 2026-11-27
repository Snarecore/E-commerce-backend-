/**
 * Single source of truth for which browser origins may call the API (HTTP and WebSocket).
 *
 * Origins are compared by exact match after normalisation. A prefix match would let
 * `https://shop.com.evil.net` through when `https://shop.com` is allowed.
 */

const DEFAULT_DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
];

const DEV_LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const DEV_PRIVATE_NETWORK_ORIGIN =
    /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

export function normalizeOrigin(value: string): string {
    return value.trim().replace(/\/+$/, '').toLowerCase();
}

export function splitList(value: string | undefined): string[] {
    return (value || '')
        .split(',')
        .map(normalizeOrigin)
        .filter((origin) => origin.length > 0 && origin !== '*');
}

/**
 * Reads the allow-list from the environment on every call, so it reflects values loaded
 * by dotenv/ConfigModule after this module was first imported.
 *
 * `ALLOWED_ORIGINS` is the primary setting. `FRONTEND_URL`, `ADMIN_URL`, `APP_URL` and
 * `CORS_ORIGINS` are also honoured because the socket gateway historically read them.
 * A `*` entry is ignored: credentialed requests must never be open to every site.
 */
export function getAllowedOrigins(): string[] {
    const configured = splitList(process.env.ALLOWED_ORIGINS);
    const base = configured.length > 0 ? configured : DEFAULT_DEV_ORIGINS.map(normalizeOrigin);
    const extra = [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        process.env.APP_URL,
        process.env.CORS_ORIGINS,
    ].flatMap(splitList);
    return Array.from(new Set([...base, ...extra]));
}

export function isOriginAllowed(origin: string | undefined): boolean {
    // Non-browser clients (server-to-server, mobile apps, curl) send no Origin header.
    if (!origin) return true;

    const normalized = normalizeOrigin(origin);
    if (getAllowedOrigins().includes(normalized)) return true;

    const isProd = process.env.NODE_ENV === 'production';
    return (
        !isProd &&
        (DEV_LOCAL_ORIGIN.test(normalized) || DEV_PRIVATE_NETWORK_ORIGIN.test(normalized))
    );
}

export function corsOriginCallback(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
): void {
    callback(null, isOriginAllowed(origin));
}
