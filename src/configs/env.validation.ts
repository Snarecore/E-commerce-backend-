import { z } from 'zod';

// 🛡️ Bulletproof boolean parsing: eliminates Boolean('false') === true JavaScript trap
const booleanEnv = (defaultValue: boolean = false) =>
	z
		.preprocess((val) => {
			if (typeof val === 'boolean') return val ? 'true' : 'false';
			if (typeof val === 'string') return val.trim().toLowerCase();
			return val;
		}, z.enum(['true', 'false']))
		.default(defaultValue ? 'true' : 'false')
		.transform((val) => val === 'true');

const portRange = z.coerce.number().int().min(1).max(65535);

const disallowedLoopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export const EnvSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
		PORT: portRange.default(5000),

		// Database Connection Parameters (TiDB Cloud / MySQL)
		DATABASE_HOST: z.string().min(1, 'DATABASE_HOST is required'),
		DATABASE_PORT: portRange.default(4000),
		DATABASE_USERNAME: z.string().min(1, 'DATABASE_USERNAME is required'),
		DATABASE_PASSWORD: z.string().min(1, 'DATABASE_PASSWORD is required'),
		DATABASE_NAME: z.string().min(1, 'DATABASE_NAME is required'),
		DATABASE_SSL: booleanEnv(true),

		// Database Pool Configuration
		DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).default(20),
		DB_MAX_IDLE: z.coerce.number().int().min(0).default(10),
		DB_CONNECT_TIMEOUT: z.coerce.number().int().min(1000).default(5000),
		DB_IDLE_TIMEOUT: z.coerce.number().int().min(1000).default(60000),
		MYSQL_MAX_CONNECTIONS: z.coerce.number().int().min(1).default(150),
		DB_CONNECTION_BUDGET_PERCENT: z.coerce.number().int().min(1).max(100).default(70),
		PM2_INSTANCES: z.coerce.number().int().min(1).default(1),

		// Authentication & Security (Entropy & Non-Trivial Guarantee)
		JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
		JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must have at least 32 characters'),
		GUEST_ORDER_TOKEN_SECRET: z.string().min(32, 'GUEST_ORDER_TOKEN_SECRET must be at least 32 characters').optional(),
		ENABLE_GUEST_CHECKOUT: booleanEnv(true),

		// API & Public URLs
		BACKEND_PUBLIC_URL: z.string().url('BACKEND_PUBLIC_URL must be a valid URL'),
		FRONTEND_PUBLIC_URL: z.string().url('FRONTEND_PUBLIC_URL must be a valid URL'),
		PASSWORD_RESET_PAGE: z.string().url('PASSWORD_RESET_PAGE must be a valid URL'),
		ALLOWED_ORIGINS: z.string().optional(),

		// Payment Gateways Feature Flags
		ENABLE_STRIPE: booleanEnv(true),
		ENABLE_SSLCOMMERZ: booleanEnv(true),

		// Stripe Credentials (Conditional on ENABLE_STRIPE)
		STRIPE_SECRET_KEY: z.string().optional(),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),
		STRIPE_PUBLIC_KEY: z.string().optional(),

		// SSLCommerz Credentials (Conditional on ENABLE_SSLCOMMERZ)
		SSLCOMMERZ_IS_LIVE: booleanEnv(false),
		SSLCOMMERZ_STORE_ID: z.string().optional(),
		SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),

		// Cloudinary Storage
		CLOUDINARY_CLOUD_NAME: z.string().optional(),
		CLOUDINARY_API_KEY: z.string().optional(),
		CLOUDINARY_API_SECRET: z.string().optional(),

		// Email Service (SMTP)
		EMAIL_HOST: z.string().optional(),
		EMAIL_PORT: portRange.default(465),
		EMAIL_SECURE: booleanEnv(true),
		EMAIL_USER: z.string().optional(),
		EMAIL_PASS: z.string().optional(),
		EMAIL_SENDER_NAME: z.string().default('BazaarBound'),
		EMAIL_SENDER_MAIL: z.string().email('EMAIL_SENDER_MAIL must be a valid email address').optional(),

		// Risk Engine Phone Hashing
		PHONE_HMAC_SECRET_V1: z.string().optional(),
		PHONE_HMAC_SECRET_V2: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		const isProd = data.NODE_ENV === 'production';

		// 🛡️ Invariant 1: High-Entropy Secret Protection (reject known trivial placeholders)
		const knownWeakSecrets = [
			'12345678901234567890123456789012',
			'secretsecretsecretsecretsecret32',
			'default_secure_guest_order_token_signing_secret_key_32chars',
		];
		if (knownWeakSecrets.includes(data.JWT_SECRET)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['JWT_SECRET'],
				message: '[SECURITY REJECTION] JWT_SECRET matches a trivial or default placeholder. Provide high-entropy secrets.',
			});
		}

		// 🛡️ Invariant 2: Guest Checkout Secret In Production
		if (data.ENABLE_GUEST_CHECKOUT && isProd && !data.GUEST_ORDER_TOKEN_SECRET) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['GUEST_ORDER_TOKEN_SECRET'],
				message: '[SECURITY REJECTION] GUEST_ORDER_TOKEN_SECRET is required in production when guest checkout is enabled.',
			});
		}

		// 🛡️ Invariant 3: URL Protocol & Host Inspection (Strict HTTPS & Loopback Rejection in Prod)
		const inspectUrl = (urlStr: string, fieldName: string) => {
			try {
				const parsed = new URL(urlStr);
				if (isProd) {
					if (parsed.protocol !== 'https:') {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: [fieldName],
							message: `[PROD CONFIG ERROR] ${fieldName} must use HTTPS in production. Received protocol: "${parsed.protocol}"`,
						});
					}
					if (disallowedLoopbackHosts.has(parsed.hostname.toLowerCase())) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: [fieldName],
							message: `[PROD CONFIG ERROR] ${fieldName} cannot resolve to loopback address (${parsed.hostname}) in production mode. Set your live public domain.`,
						});
					}
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [fieldName],
					message: `Invalid URL format for ${fieldName}.`,
				});
			}
		};
		inspectUrl(data.BACKEND_PUBLIC_URL, 'BACKEND_PUBLIC_URL');
		inspectUrl(data.FRONTEND_PUBLIC_URL, 'FRONTEND_PUBLIC_URL');
		inspectUrl(data.PASSWORD_RESET_PAGE, 'PASSWORD_RESET_PAGE');

		// 🛡️ Invariant 4: Conditional Stripe Validation
		if (data.ENABLE_STRIPE) {
			if (!data.STRIPE_SECRET_KEY || data.STRIPE_SECRET_KEY.trim().length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['STRIPE_SECRET_KEY'],
					message: 'STRIPE_SECRET_KEY is mandatory when ENABLE_STRIPE is true.',
				});
			}
			if (!data.STRIPE_WEBHOOK_SECRET || data.STRIPE_WEBHOOK_SECRET.trim().length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['STRIPE_WEBHOOK_SECRET'],
					message: 'STRIPE_WEBHOOK_SECRET is mandatory when ENABLE_STRIPE is true.',
				});
			}
		}

		// 🛡️ Invariant 5: Conditional SSLCommerz Validation
		if (data.ENABLE_SSLCOMMERZ) {
			const storeId = (data.SSLCOMMERZ_STORE_ID || '').trim();
			const storePass = (data.SSLCOMMERZ_STORE_PASSWORD || '').trim();

			if (!storeId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['SSLCOMMERZ_STORE_ID'],
					message: 'SSLCOMMERZ_STORE_ID is mandatory when ENABLE_SSLCOMMERZ is true.',
				});
			}
			if (!storePass) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['SSLCOMMERZ_STORE_PASSWORD'],
					message: 'SSLCOMMERZ_STORE_PASSWORD is mandatory when ENABLE_SSLCOMMERZ is true.',
				});
			}

			// In Live Mode: strictly forbid testbox / qwerty
			if (data.SSLCOMMERZ_IS_LIVE) {
				if (storeId.toLowerCase() === 'testbox') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['SSLCOMMERZ_STORE_ID'],
						message: '[SECURITY VIOLATION] SSLCOMMERZ_STORE_ID cannot be "testbox" when SSLCOMMERZ_IS_LIVE is true.',
					});
				}
				if (storePass.toLowerCase() === 'qwerty') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['SSLCOMMERZ_STORE_PASSWORD'],
						message: '[SECURITY VIOLATION] SSLCOMMERZ_STORE_PASSWORD cannot be "qwerty" when SSLCOMMERZ_IS_LIVE is true.',
					});
				}
			}
		}
	});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
	// Support DB_* aliases if DATABASE_* is missing
	const resolvedConfig: Record<string, unknown> = { ...config };
	if (!resolvedConfig.DATABASE_HOST && resolvedConfig.DB_HOST) resolvedConfig.DATABASE_HOST = resolvedConfig.DB_HOST;
	if (!resolvedConfig.DATABASE_PORT && resolvedConfig.DB_PORT) resolvedConfig.DATABASE_PORT = resolvedConfig.DB_PORT;
	if (!resolvedConfig.DATABASE_USERNAME && resolvedConfig.DB_USER) resolvedConfig.DATABASE_USERNAME = resolvedConfig.DB_USER;
	if (!resolvedConfig.DATABASE_PASSWORD && resolvedConfig.DB_PASSWORD) resolvedConfig.DATABASE_PASSWORD = resolvedConfig.DB_PASSWORD;
	if (!resolvedConfig.DATABASE_NAME && resolvedConfig.DB_NAME) resolvedConfig.DATABASE_NAME = resolvedConfig.DB_NAME;
	if (!resolvedConfig.DATABASE_SSL && resolvedConfig.DB_SSL) resolvedConfig.DATABASE_SSL = resolvedConfig.DB_SSL;

	// 🛡️ Intelligent Fallback 1: GUEST_ORDER_TOKEN_SECRET falls back to JWT_SECRET if not explicitly set
	if (!resolvedConfig.GUEST_ORDER_TOKEN_SECRET && resolvedConfig.JWT_SECRET) {
		resolvedConfig.GUEST_ORDER_TOKEN_SECRET = resolvedConfig.JWT_SECRET;
	}

	// 🛡️ Intelligent Fallback 2: Auto-derive live PASSWORD_RESET_PAGE from FRONTEND_PUBLIC_URL if missing or pointing to localhost
	const frontendUrlStr = String(resolvedConfig.FRONTEND_PUBLIC_URL || '').trim();
	const passResetStr = String(resolvedConfig.PASSWORD_RESET_PAGE || '').trim();
	if (
		frontendUrlStr.startsWith('https://') &&
		(!passResetStr || passResetStr.includes('localhost') || passResetStr.startsWith('http://'))
	) {
		resolvedConfig.PASSWORD_RESET_PAGE = `${frontendUrlStr.replace(/\/+$/, '')}/reset-password`;
	}

	// 🛡️ Intelligent Fallback 3: Auto-derive BACKEND_PUBLIC_URL from VERCEL_URL if on Vercel and points to localhost
	const vercelUrlStr = String(resolvedConfig.VERCEL_URL || process.env.VERCEL_URL || '').trim();
	const backendUrlStr = String(resolvedConfig.BACKEND_PUBLIC_URL || '').trim();
	if (vercelUrlStr && (!backendUrlStr || backendUrlStr.includes('localhost'))) {
		resolvedConfig.BACKEND_PUBLIC_URL = `https://${vercelUrlStr}/api/v1`;
	}

	const parseResult = EnvSchema.safeParse(resolvedConfig);

	if (!parseResult.success) {
		const formattedErrors = parseResult.error.issues
			.map((issue) => `  ❌ [${issue.path.join('.')}]: ${issue.message}`)
			.join('\n');
		throw new Error(`\n=======================================================\n🚨 [FATAL CONFIGURATION ERROR] Environment validation failed:\n=======================================================\n${formattedErrors}\n=======================================================\n`);
	}

	return parseResult.data;
}
