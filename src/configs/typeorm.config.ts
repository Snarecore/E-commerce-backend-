import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
	const configService = new ConfigService();

	const host = configService.get<string>('DATABASE_HOST') || configService.get<string>('DB_HOST');
	const port = Number(configService.get('DATABASE_PORT') || configService.get('DB_PORT')) || 4000;
	const username = configService.get<string>('DATABASE_USERNAME') || configService.get<string>('DB_USER');
	const password = configService.get<string>('DATABASE_PASSWORD') || configService.get<string>('DB_PASSWORD');
	const database = configService.get<string>('DATABASE_NAME') || configService.get<string>('DB_NAME');
	const sslConfig = configService.get<string>('DATABASE_SSL') || configService.get<string>('DB_SSL');

	const isSslRequired = sslConfig === 'true' || host?.includes('tidbcloud.com');

	return {
		type: 'mysql',
		host,
		port,
		username,
		password,
		database,
		ssl: isSslRequired ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false,
		autoLoadEntities: true,
		entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
		synchronize: false,
		dropSchema: false,
		logging: false,
		migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
		migrationsTableName: 'migrations'
	};
};

export const dataSource = new DataSource(getTypeOrmConfig() as DataSourceOptions);
