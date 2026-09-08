import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

function getValidatedInt(configService: ConfigService, key: string, defaultValue: number, min: number = 1): number {
	const rawVal = configService.get<string>(key);
	if (rawVal === undefined || rawVal === null || rawVal.trim() === '') return defaultValue;
	const parsed = Number(rawVal);
	if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < min) {
		throw new Error(`[Config Error] Environment variable ${key} must be a valid integer >= ${min}. Received: "${rawVal}"`);
	}
	return parsed;
}

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
	const configService = new ConfigService();

	const host = configService.get<string>('DATABASE_HOST') || configService.get<string>('DB_HOST');
	const port = Number(configService.get('DATABASE_PORT') || configService.get('DB_PORT')) || 4000;
	const username = configService.get<string>('DATABASE_USERNAME') || configService.get<string>('DB_USER');
	const password = configService.get<string>('DATABASE_PASSWORD') || configService.get<string>('DB_PASSWORD');
	const database = configService.get<string>('DATABASE_NAME') || configService.get<string>('DB_NAME');
	const sslConfig = configService.get<string>('DATABASE_SSL') || configService.get<string>('DB_SSL');

	const isSslRequired = sslConfig === 'true' || host?.includes('tidbcloud.com');

	const connectionLimit = getValidatedInt(configService, 'DB_CONNECTION_LIMIT', 20, 1);
	const maxIdle = getValidatedInt(configService, 'DB_MAX_IDLE', 10, 0);
	if (maxIdle > connectionLimit) {
		throw new Error(`[Config Error] DB_MAX_IDLE (${maxIdle}) cannot exceed DB_CONNECTION_LIMIT (${connectionLimit}).`);
	}
	const connectTimeout = getValidatedInt(configService, 'DB_CONNECT_TIMEOUT', 5000, 1000);
	const idleTimeout = getValidatedInt(configService, 'DB_IDLE_TIMEOUT', 60000, 1000);

	const mysqlMaxConnections = getValidatedInt(configService, 'MYSQL_MAX_CONNECTIONS', 150, 1);
	const budgetPercent = getValidatedInt(configService, 'DB_CONNECTION_BUDGET_PERCENT', 70, 1);
	const pm2Instances = getValidatedInt(configService, 'PM2_INSTANCES', 2, 1);

	const effectiveBudget = pm2Instances * connectionLimit;
	const maxAllowedBudget = Math.floor(mysqlMaxConnections * (budgetPercent / 100));

	if (effectiveBudget > maxAllowedBudget) {
		throw new Error(`[Config Error] Effective connection budget (${effectiveBudget} connections: ${pm2Instances} workers x ${connectionLimit} pool) exceeds maximum allowed pool budget (${maxAllowedBudget} connections, which is ${budgetPercent}% of MYSQL_MAX_CONNECTIONS=${mysqlMaxConnections}). Reduce DB_CONNECTION_LIMIT or PM2_INSTANCES.`);
	}

	return {
		type: 'mysql',
		timezone: 'Z',
		host,
		port,
		username,
		password,
		database,
		ssl: isSslRequired ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false,
		extra: {
			connectionLimit,
			maxIdle,
			idleTimeout,
			waitForConnections: true,
			enableKeepAlive: true,
			keepAliveInitialDelay: 10000,
			connectTimeout,
		},
		autoLoadEntities: true,
		entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
		synchronize: false,
		dropSchema: false,
		logging: configService.get<string>('DATABASE_LOGGING') === 'true' || configService.get<string>('DB_LOGGING') === 'true',
		migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
		migrationsTableName: 'migrations'
	};
};

export const dataSource = new DataSource(getTypeOrmConfig() as DataSourceOptions);

export async function validateServerMaxConnections(ds: DataSource): Promise<void> {
	try {
		const result = await ds.query(`SHOW VARIABLES LIKE 'max_connections'`);
		if (Array.isArray(result) && result.length > 0) {
			const serverMaxConn = Number(result[0].Value || result[0].value);
			if (!isNaN(serverMaxConn) && serverMaxConn > 0) {
				const configService = new ConfigService();
				const connectionLimit = getValidatedInt(configService, 'DB_CONNECTION_LIMIT', 20, 1);
				const budgetPercent = getValidatedInt(configService, 'DB_CONNECTION_BUDGET_PERCENT', 70, 1);
				const pm2Instances = getValidatedInt(configService, 'PM2_INSTANCES', 2, 1);

				const effectiveBudget = pm2Instances * connectionLimit;
				const maxAllowedBudget = Math.floor(serverMaxConn * (budgetPercent / 100));

				console.log(`[DB Budget Check] SQL Server max_connections=${serverMaxConn}. Effective pool budget=${effectiveBudget} (${pm2Instances} workers x ${connectionLimit}). Max allowed (${budgetPercent}%)=${maxAllowedBudget}.`);

				if (effectiveBudget > maxAllowedBudget) {
					throw new Error(`[Config Error] Effective connection budget (${effectiveBudget}) exceeds actual MySQL server limit (${maxAllowedBudget}, which is ${budgetPercent}% of server max_connections=${serverMaxConn}).`);
				}
			}
		}
	} catch (e: any) {
		if (e.message && e.message.includes('[Config Error]')) {
			throw e;
		}
		console.warn(`[DB Budget Check Warning] Could not query server max_connections: ${e.message}`);
	}
}
