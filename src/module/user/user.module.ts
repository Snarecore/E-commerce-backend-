import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { SpaceService } from '../space-module/space-service/space.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([User]),
		AuthModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET'),
				signOptions: { expiresIn: '15d' }
			})
		})
	],
	controllers: [UserController],
	providers: [UserService, UserRepository, UserProfileRepository, SpaceService],
	exports: [UserService, UserRepository]
})
export class UserModule { }
