import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

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
		synchronize: true,
		dropSchema: false,
		logging: false
	};
};

export const dataSource = new DataSource(getTypeOrmConfig() as DataSourceOptions);
