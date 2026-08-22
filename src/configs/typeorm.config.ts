import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
	const configService = new ConfigService();

	return {
		type: 'mysql',
		host: configService.get<string>('DATABASE_HOST'),
		port: configService.get<number>('DATABASE_PORT'),
		username: configService.get<string>('DATABASE_USERNAME'),
		password: configService.get<string>('DATABASE_PASSWORD'),
		database: configService.get<string>('DATABASE_NAME'),
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
