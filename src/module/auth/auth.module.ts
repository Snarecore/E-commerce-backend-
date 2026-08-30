import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from '../user/user.repository';
import { User } from '../user/entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../../strategies/jwt-refresh.strategy';
import { UserProfile } from '../user-profile/entities/user-profile.entity';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { SpaceService } from '../space-module/space-service/space.service';
import { R2ServiceProvider } from '../space-module/space-service';
import { EmailService } from '../email-service/email-sender.service';
import { SesEmailService } from '../../common/ses/ses-email.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, UserProfile]),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>('JWT_SECRET'),
				signOptions: { expiresIn: '15d' }
			})
		})
	],
	providers: [UserRepository, UserProfileRepository, JwtStrategy, JwtRefreshStrategy, AuthService, SpaceService, R2ServiceProvider, EmailService, SesEmailService],
	controllers: [AuthController],
	exports: [AuthService, JwtStrategy]
})
export class AuthModule { }
