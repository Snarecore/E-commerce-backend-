import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, Res, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { Request } from 'express';
import { JwtPayload } from '../../common/types';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { UserProfile } from '../user-profile/entities/user-profile.entity';
import { toSafeUser } from '../../utils/safe-user.utils';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { UploadMulterFile } from '../space-module/space-service';
import { SpaceService } from '../space-module/space-service/space.service';
import { EmailService } from '../email-service/email-sender.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SesEmailService } from '../../common/ses/ses-email.service';
import { Role } from '../../enums/role.enum';
import { COOKIE_NAMES, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, setAuthCookie, clearAuthCookie } from '../../utils/cookie-config';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/constants/audit-action.enum';
import { AuditModule } from '../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../audit-log/constants/audit-target-type.enum';

@Injectable()
export class AuthService {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly userProfileRepository: UserProfileRepository,
		private readonly jwtService: JwtService,
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly spaceService: SpaceService,
		private readonly emailService: EmailService,
		private readonly sesEmailService: SesEmailService,
		private readonly auditLogService: AuditLogService
	) { }

	async validateUser(dto: LoginDto): Promise<User> {
		const user = await this.userRepository.findOneByQueryRelation(
			{ email: dto.email },
			{ select: ['id', 'name', 'email', 'password', 'role'] }
		);
		if (!user) {
			this.auditLogService.createAsyncLog({
				actorId: null,
				actorName: null,
				actorEmail: dto.email,
				actorRole: null,
				action: AuditAction.AUTH_LOGIN_FAILED,
				module: AuditModule.AUTH,
				targetId: null,
				targetType: AuditTargetType.USER,
				status: 'FAILED',
				changes: {
					type: 'SNAPSHOT',
					before: null,
					after: { attemptedEmail: dto.email }
				}
			});
			throw new NotFoundException('User not found.');
		}
		const isPasswordValid = await bcrypt.compare(dto.password, user.password);
		if (!isPasswordValid) {
			this.auditLogService.createAsyncLog({
				actorId: user.id,
				actorName: user.name,
				actorEmail: user.email,
				actorRole: user.role,
				action: AuditAction.AUTH_LOGIN_FAILED,
				module: AuditModule.AUTH,
				targetId: user.id,
				targetType: AuditTargetType.USER,
				status: 'FAILED',
				changes: {
					type: 'SNAPSHOT',
					before: null,
					after: { attemptedEmail: dto.email }
				}
			});
			throw new UnauthorizedException('Incorrect password.');
		}

		this.auditLogService.createAsyncLog({
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			action: AuditAction.AUTH_LOGIN_SUCCESS,
			module: AuditModule.AUTH,
			targetId: user.id,
			targetType: AuditTargetType.USER,
			status: 'SUCCESS'
		});

		return user;
	}

	async login(dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		const user = await this.validateUser(dto);

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };

		const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
		const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

		const isAdmin = user.role?.toLowerCase() === Role.ADMIN;
		const accessCookieName = isAdmin ? COOKIE_NAMES.ADMIN_ACCESS : COOKIE_NAMES.CUSTOMER_ACCESS;
		const refreshCookieName = isAdmin ? COOKIE_NAMES.ADMIN_REFRESH : COOKIE_NAMES.CUSTOMER_REFRESH;

		setAuthCookie(res, accessCookieName, accessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, refreshCookieName, refreshToken, REFRESH_TOKEN_MAX_AGE);
		setAuthCookie(res, 'accessToken', accessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, 'refreshToken', refreshToken, REFRESH_TOKEN_MAX_AGE);

		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		};

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Login successful.',
			'data',
			{
				accessToken,
				user: userData
			}
		);
	}

	async me(currentUser: any) {
		if (!currentUser || !currentUser.id) {
			throw new UnauthorizedException('Not authenticated.');
		}

		const user = await this.userRepository.findOneByQueryRelation(
			{ id: currentUser.id },
			{ select: ['id', 'name', 'email', 'role'] }
		);

		if (!user) {
			throw new UnauthorizedException('User session not found.');
		}

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'User session fetched successfully.',
			'data',
			{
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role
			}
		);
	}

	async register(dto: RegisterDto): Promise<ApiResponse<User>> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const userExists = await this.userRepository.findOneByQueryIncludingDeleted({ email: dto.email });
			if (userExists) {
				throw new ConflictException('Email already exists.');
			}

			const { password, confirmPassword, ...userData } = dto;
			if (password !== confirmPassword) {
				throw new BadRequestException('Password and confirm password do not match.');
			}
			const hashedPassword = await bcrypt.hash(password, 10);

			const userEntity = queryRunner.manager.create(User, {
				...userData,
				password: hashedPassword,
				role: dto.role || Role.CUSTOMER
			});
			const createdUser = await queryRunner.manager.save(User, userEntity);

			if (createdUser) {
				const profileEntity = queryRunner.manager.create(UserProfile, {
					user: createdUser
				});
				await queryRunner.manager.save(UserProfile, profileEntity);
			}

			await queryRunner.commitTransaction();
			return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Registration successful.', 'data', toSafeUser(createdUser) as unknown as User);
		} catch (error) {
			await queryRunner.rollbackTransaction();
			if (error instanceof HttpException) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		} finally {
			await queryRunner.release();
		}
	}

	async vendorRegister(
		dto: VendorRegisterDto,
		files: {
			shopImage?: UploadMulterFile
		}
	): Promise<ApiResponse<User>> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const userExists = await this.userRepository.findOneByQueryIncludingDeleted({ email: dto.email });
			if (userExists) {
				throw new ConflictException('Email already exists.');
			}

			if (files && files.shopImage) {
				const shopImage: any = await this.spaceService.uploadFile(files.shopImage[0], "users");
				dto.shopImage = shopImage;
			}

			const { password, confirmPassword, shopName, shopImage, ...userData } = dto;
			if (password !== confirmPassword) {
				throw new BadRequestException('Password and confirm password do not match.');
			}
			const hashedPassword = await bcrypt.hash(password, 10);

			const userEntity = queryRunner.manager.create(User, {
				...userData,
				password: hashedPassword,
				role: dto.role || Role.VENDOR
			});
			const createdUser = await queryRunner.manager.save(User, userEntity);

			if (createdUser) {
				const profileEntity = queryRunner.manager.create(UserProfile, {
					user: createdUser,
					shopName: shopName,
					shopImage: shopImage
				});
				await queryRunner.manager.save(UserProfile, profileEntity);
			}

			await queryRunner.commitTransaction();
			return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Data saved successfully.', 'data', toSafeUser(createdUser) as unknown as User);
		} catch (error) {
			await queryRunner.rollbackTransaction();
			if (error instanceof HttpException) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		} finally {
			await queryRunner.release();
		}
	}

	async refreshToken(req: Request, res: Response): Promise<{ accessToken: string }> {
		const refreshToken =
			req.cookies?.[COOKIE_NAMES.ADMIN_REFRESH] ||
			req.cookies?.[COOKIE_NAMES.CUSTOMER_REFRESH] ||
			req.cookies?.['refreshToken'] ||
			(req.headers?.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
		if (!refreshToken) {
			throw new UnauthorizedException('Refresh token not found.');
		}

		let decoded: JwtPayload;
		try {
			decoded = this.jwtService.verify(refreshToken);
		} catch (error) {
			throw new UnauthorizedException('Invalid refresh token.');
		}

		const user = await this.userRepository.findOneByQuery({ email: decoded?.email });
		if (!user) {
			throw new UnauthorizedException('User not found for refresh token.');
		}

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };
		const newAccessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
		const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

		const isAdmin = user.role?.toLowerCase() === Role.ADMIN;
		const accessCookieName = isAdmin ? COOKIE_NAMES.ADMIN_ACCESS : COOKIE_NAMES.CUSTOMER_ACCESS;
		const refreshCookieName = isAdmin ? COOKIE_NAMES.ADMIN_REFRESH : COOKIE_NAMES.CUSTOMER_REFRESH;

		setAuthCookie(res, accessCookieName, newAccessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, refreshCookieName, newRefreshToken, REFRESH_TOKEN_MAX_AGE);
		setAuthCookie(res, 'accessToken', newAccessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, 'refreshToken', newRefreshToken, REFRESH_TOKEN_MAX_AGE);

		return { accessToken: newAccessToken };
	}

	logout(res: Response): void {
		clearAuthCookie(res, COOKIE_NAMES.CUSTOMER_ACCESS);
		clearAuthCookie(res, COOKIE_NAMES.CUSTOMER_REFRESH);
		clearAuthCookie(res, COOKIE_NAMES.ADMIN_ACCESS);
		clearAuthCookie(res, COOKIE_NAMES.ADMIN_REFRESH);
		clearAuthCookie(res, 'accessToken');
		clearAuthCookie(res, 'refreshToken');
	}

	async forgotPassword(email: string) {
		try {
			const user = await this.userRepository.findOneByQuery({ email: email });

			if (!user) {
				throw new NotFoundException('User with this email not found');
			}

			const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
			const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

			await this.userRepository.update(user.id, {
				resetToken: resetToken,
				resetTokenExpiry: resetTokenExpiresAt
			});

			await this.emailService.sendResetPasswordEmail({
				to: [user.email],
				from: process.env.EMAIL_SENDER_MAIL
					? `"${process.env.EMAIL_SENDER_NAME || 'Support'}" <${process.env.EMAIL_SENDER_MAIL}>`
					: `"support" <support@bazaarbound.com>`,
				subject: 'Reset Your Password',
				username: `${user.name}`,
				token: resetToken,
				email: user.email,
				companyEmail: process.env.EMAIL_SENDER_MAIL || 'support@bazaarbound.com'
			});

			return ResponseUtils.successResponseHandler(
				HttpStatus.OK,
				'Reset password link sent to email address',
				'data',
				resetToken
			);
		} catch (error) {
			console.log(error);
		}
	}

	async resetPassword(dto: ResetPasswordDto) {
		const { email, token, newPassword, confirmPassword } = dto;

		const user = await this.userRepository.findOneByQueryRelation(
			{ email: email },
			{ select: ['id', 'email', 'resetToken', 'resetTokenExpiry'] }
		);
		if (!user) {
			throw new NotFoundException('User not found.');
		}

		if (!user.resetToken || !user.resetTokenExpiry) {
			throw new BadRequestException('No reset token found');
		}

		const now = new Date();
		if (user.resetToken !== token) {
			throw new BadRequestException('Invalid reset token.');
		}

		if (user.resetTokenExpiry < now) {
			throw new BadRequestException('Reset token has expired.');
		}

		if (newPassword !== confirmPassword) {
			throw new BadRequestException('Passwords do not match.');
		}

		const hashedPassword = await bcrypt.hash(newPassword, 10);
		const response = await this.userRepository.update(user.id, {
			resetToken: undefined,
			resetTokenExpiry: undefined,
			password: hashedPassword
		});

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Password has been reset successfully',
			'data',
			response
		);
	}
}
