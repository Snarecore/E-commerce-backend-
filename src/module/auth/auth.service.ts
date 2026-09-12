import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, Res, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { Request } from 'express';
import { JwtPayload } from '../../common/types';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { UserProfile } from '../user-profile/entities/user-profile.entity';
import { toSafeUser } from '../../utils/safe-user.utils';
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

	private extractClientInfo(req?: Request) {
		if (!req) return { ipAddress: null, userAgent: null };
		const xForwardedFor = req.headers?.['x-forwarded-for'];
		let ipAddress: string | null = null;
		if (typeof xForwardedFor === 'string') {
			ipAddress = xForwardedFor.split(',')[0].trim();
		} else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
			ipAddress = xForwardedFor[0];
		} else if (req.headers?.['x-real-ip']) {
			ipAddress = req.headers['x-real-ip'] as string;
		} else {
			ipAddress = req.ip || req.socket?.remoteAddress || null;
		}

		if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
			ipAddress = '127.0.0.1';
		}

		const userAgent = (req.headers?.['user-agent'] as string) || null;
		return { ipAddress, userAgent };
	}

	async validateUser(dto: LoginDto, req?: Request): Promise<User> {
		const { ipAddress, userAgent } = this.extractClientInfo(req);

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
				ipAddress,
				userAgent,
				httpMethod: 'POST',
				route: '/api/v1/auth/login',
				changes: {
					type: 'SNAPSHOT',
					before: null,
					after: { attemptedEmail: dto.email, reason: 'User not found' }
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
				ipAddress,
				userAgent,
				httpMethod: 'POST',
				route: '/api/v1/auth/login',
				changes: {
					type: 'SNAPSHOT',
					before: null,
					after: { attemptedEmail: dto.email, reason: 'Incorrect password' }
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
			status: 'SUCCESS',
			ipAddress,
			userAgent,
			httpMethod: 'POST',
			route: '/api/v1/auth/login'
		});

		return user;
	}

	async login(dto: LoginDto, @Res({ passthrough: true }) res: Response, req?: Request) {
		const user = await this.validateUser(dto, req);

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };

		const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
		const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

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
				refreshToken,
				user: userData
			}
		);
	}

	async firebaseLogin(
		dto: { idToken: string; email?: string; name?: string; photoURL?: string; firebaseUid?: string },
		res: Response,
		req?: Request
	) {
		const { ipAddress, userAgent } = this.extractClientInfo(req);
		const email = dto.email || `${dto.firebaseUid || Date.now()}@google.user`;
		const name = dto.name || email.split('@')[0] || "User";

		let user = await this.userRepository.findOneByQueryRelation({ email });
		let isNewUser = false;
		if (!user) {
			isNewUser = true;
			user = await this.userRepository.create({
				email,
				name,
				password: await bcrypt.hash(Math.random().toString(36), 10),
				phone: 'N/A',
				role: Role.CUSTOMER
			});
		}

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };
		const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
		const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

		const accessCookieName = COOKIE_NAMES.CUSTOMER_ACCESS;
		const refreshCookieName = COOKIE_NAMES.CUSTOMER_REFRESH;

		setAuthCookie(res, accessCookieName, accessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, refreshCookieName, refreshToken, REFRESH_TOKEN_MAX_AGE);
		setAuthCookie(res, 'accessToken', accessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, 'refreshToken', refreshToken, REFRESH_TOKEN_MAX_AGE);

		// Record audit log for Google/Firebase login
		this.auditLogService.createAsyncLog({
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			action: isNewUser ? AuditAction.AUTH_REGISTER : AuditAction.AUTH_LOGIN_SUCCESS,
			module: AuditModule.AUTH,
			targetId: user.id,
			targetType: AuditTargetType.USER,
			status: 'SUCCESS',
			ipAddress,
			userAgent,
			httpMethod: 'POST',
			route: '/api/v1/auth/firebase-login',
			changes: {
				type: 'SNAPSHOT',
				before: null,
				after: { authProvider: 'Google/Firebase', email: user.email, isNewUser }
			}
		});

		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		};

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Google login successful.',
			'data',
			{
				accessToken,
				refreshToken,
				user: userData
			}
		);
	}

	async me(currentUser: any) {
		const userId = currentUser?.id || currentUser?.userId || currentUser?.sub;
		if (!userId && !currentUser?.email) {
			throw new UnauthorizedException('Not authenticated.');
		}

		let user: User | null = null;
		if (userId) {
			user = await this.userRepository.findOneByQueryRelation(
				{ id: userId },
				{ select: ['id', 'name', 'email', 'role'] }
			);
		}

		if (!user && currentUser?.email) {
			user = await this.userRepository.findOneByQueryRelation(
				{ email: currentUser.email },
				{ select: ['id', 'name', 'email', 'role'] }
			);
		}

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

	async register(dto: RegisterDto, req?: Request): Promise<ApiResponse<User>> {
		const { ipAddress, userAgent } = this.extractClientInfo(req);
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

			this.auditLogService.createAsyncLog({
				actorId: createdUser.id,
				actorName: createdUser.name,
				actorEmail: createdUser.email,
				actorRole: createdUser.role,
				action: AuditAction.AUTH_REGISTER,
				module: AuditModule.AUTH,
				targetId: createdUser.id,
				targetType: AuditTargetType.USER,
				status: 'SUCCESS',
				ipAddress,
				userAgent,
				httpMethod: 'POST',
				route: '/api/v1/auth/register',
				changes: {
					type: 'SNAPSHOT',
					before: null,
					after: { name: createdUser.name, email: createdUser.email, role: createdUser.role }
				}
			});

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

	async refreshToken(req: Request, res: Response): Promise<{ accessToken: string; refreshToken: string; user?: any }> {
		const refreshToken =
			req.cookies?.[COOKIE_NAMES.ADMIN_REFRESH] ||
			req.cookies?.[COOKIE_NAMES.CUSTOMER_REFRESH] ||
			req.cookies?.['refreshToken'] ||
			(req.body as any)?.refreshToken ||
			(req as any)?.user?.refreshToken ||
			(req.headers?.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
		if (!refreshToken) {
			throw new UnauthorizedException('Refresh token not found.');
		}

		let decoded: any;
		try {
			decoded = this.jwtService.verify(refreshToken);
		} catch (error) {
			try {
				decoded = this.jwtService.decode(refreshToken);
			} catch (decodeErr) {}
			if (!decoded) {
				throw new UnauthorizedException('Invalid refresh token.');
			}
		}

		const userIdentifier = decoded?.email || decoded?.sub || decoded?.id || (req as any)?.user?.email || (req as any)?.user?.id;
		let user: User | null = null;
		if (userIdentifier) {
			user = await this.userRepository.findOneByQuery({ email: userIdentifier });
			if (!user) {
				user = await this.userRepository.findOneByQuery({ id: userIdentifier });
			}
		}

		if (!user) {
			throw new UnauthorizedException('User not found for refresh token.');
		}

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };
		const newAccessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
		const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

		const isAdmin = user.role?.toLowerCase() === Role.ADMIN;
		const accessCookieName = isAdmin ? COOKIE_NAMES.ADMIN_ACCESS : COOKIE_NAMES.CUSTOMER_ACCESS;
		const refreshCookieName = isAdmin ? COOKIE_NAMES.ADMIN_REFRESH : COOKIE_NAMES.CUSTOMER_REFRESH;

		setAuthCookie(res, accessCookieName, newAccessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, refreshCookieName, newRefreshToken, REFRESH_TOKEN_MAX_AGE);
		setAuthCookie(res, 'accessToken', newAccessToken, ACCESS_TOKEN_MAX_AGE);
		setAuthCookie(res, 'refreshToken', newRefreshToken, REFRESH_TOKEN_MAX_AGE);

		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		};

		return {
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
			user: userData
		};
	}

	logout(res: Response, _req?: Request): void {
		clearAuthCookie(res, COOKIE_NAMES.CUSTOMER_ACCESS);
		clearAuthCookie(res, COOKIE_NAMES.CUSTOMER_REFRESH);
		clearAuthCookie(res, COOKIE_NAMES.ADMIN_ACCESS);
		clearAuthCookie(res, COOKIE_NAMES.ADMIN_REFRESH);
		clearAuthCookie(res, 'accessToken');
		clearAuthCookie(res, 'refreshToken');
	}

	async forgotPassword(email: string) {
		try {
			const cleanEmail = (email || '').trim().toLowerCase();
			const user = await this.userRepository.findOneByQuery({ email: cleanEmail });

			if (!user) {
				return ResponseUtils.successResponseHandler(
					HttpStatus.OK,
					'If your email is registered, a password reset code has been sent.',
					'data',
					{ sent: true }
				);
			}

			const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
			const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
			const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			await this.userRepository.update(user.id, {
				resetToken: hashedResetToken,
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
				'If your email is registered, a password reset code has been sent to your email.',
				'data',
				{ sent: true }
			);
		} catch (error) {
			console.log(error);
			throw new HttpException('Failed to process forgot password request', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async resetPassword(dto: ResetPasswordDto) {
		const { email, token, newPassword, confirmPassword } = dto;
		const cleanEmail = (email || '').trim().toLowerCase();
		const cleanToken = (token || '').trim();

		const user = await this.userRepository.findOneByQueryRelation(
			{ email: cleanEmail },
			{ select: ['id', 'email', 'resetToken', 'resetTokenExpiry'] }
		);
		if (!user) {
			throw new NotFoundException('User not found.');
		}

		if (!user.resetToken || !user.resetTokenExpiry) {
			throw new BadRequestException('No reset token found or already used.');
		}

		const now = new Date();
		if (new Date(user.resetTokenExpiry) < now) {
			throw new BadRequestException('Reset token has expired.');
		}

		const hashedIncomingToken = crypto.createHash('sha256').update(cleanToken).digest('hex');
		if (user.resetToken !== hashedIncomingToken && user.resetToken !== cleanToken) {
			throw new BadRequestException('Invalid reset token.');
		}

		if (newPassword !== confirmPassword) {
			throw new BadRequestException('Passwords do not match.');
		}

		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await this.userRepository.update(user.id, {
			resetToken: null as any,
			resetTokenExpiry: null as any,
			password: hashedPassword
		});

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Password has been reset successfully',
			'data',
			{ success: true }
		);
	}
}
