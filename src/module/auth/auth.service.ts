import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
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
import { clearSessionCookies, readRefreshCookie, setSessionCookies } from '../../utils/cookie-config';
import { ensureFirebaseAdmin } from '../../utils/firebase-admin.util';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { ConfigService } from '@nestjs/config';
import { AuthSessionService } from './session/auth-session.service';
import { SessionUser } from './session/auth-token.types';
import { FirebaseLoginDto } from './dto/firebase-login.dto';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/constants/audit-action.enum';
import { AuditModule } from '../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../audit-log/constants/audit-target-type.enum';

@Injectable()
export class AuthService {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly userProfileRepository: UserProfileRepository,
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly spaceService: SpaceService,
		private readonly emailService: EmailService,
		private readonly sesEmailService: SesEmailService,
		private readonly auditLogService: AuditLogService,
		private readonly authSessionService: AuthSessionService,
		private readonly configService: ConfigService
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

	async login(dto: LoginDto, res: Response, req?: Request) {
		const user = await this.validateUser(dto, req);
		await this.startSession(user, res, req);

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Login successful.', 'data', {
			user: this.toSessionUser(user)
		});
	}

	private toSessionUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'>): SessionUser {
		return { id: user.id, name: user.name, email: user.email, role: user.role };
	}

	/** Creates a refresh session and writes both auth cookies. Tokens never go in the body. */
	private async startSession(user: Pick<User, 'id' | 'name' | 'email' | 'role'>, res: Response, req?: Request): Promise<void> {
		const tokens = await this.authSessionService.createSession(this.toSessionUser(user), this.extractClientInfo(req));
		setSessionCookies(res, user.role, tokens);
	}

	async firebaseLogin(dto: FirebaseLoginDto, res: Response, req?: Request) {
		const { ipAddress, userAgent } = this.extractClientInfo(req);

		// Identity must come from a Google-signed ID token, never from client-supplied fields
		if (!ensureFirebaseAdmin((key) => this.configService.get<string>(key))) {
			throw new ServiceUnavailableException('Google sign-in is not configured on the server.');
		}
		let decoded: DecodedIdToken;
		try {
			decoded = await getAuth().verifyIdToken(dto.idToken, true);
		} catch {
			throw new UnauthorizedException('Invalid Google sign-in token.');
		}
		if (!decoded.email || decoded.email_verified !== true) {
			throw new UnauthorizedException('Google account email is not verified.');
		}

		const email = decoded.email.trim().toLowerCase();
		const name = decoded.name || dto.name || email.split('@')[0] || 'User';

		let user = await this.userRepository.findOneByQueryRelation({ email });
		let isNewUser = false;
		if (!user) {
			isNewUser = true;
			user = await this.userRepository.create({
				email,
				name,
				password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
				phone: 'N/A',
				role: Role.CUSTOMER
			});
		}

		await this.startSession(user, res, req);

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

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Google login successful.', 'data', {
			user: this.toSessionUser(user)
		});
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

	issueSocketToken(currentUser: any) {
		if (!currentUser?.id) {
			throw new UnauthorizedException('Not authenticated.');
		}
		const token = this.authSessionService.signSocketToken(this.toSessionUser(currentUser));
		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Socket token issued.', 'data', { token });
	}

	// Public sign-up always creates a customer; only the admin-only route may pass allowRole
	async register(dto: RegisterDto, req?: Request, allowRole = false): Promise<ApiResponse<User>> {
		const { ipAddress, userAgent } = this.extractClientInfo(req);
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const userExists = await this.userRepository.findOneByQueryIncludingDeleted({ email: dto.email });
			if (userExists) {
				throw new ConflictException('Email already exists.');
			}

			const { password, confirmPassword, role: _role, ...userData } = dto;
			if (password !== confirmPassword) {
				throw new BadRequestException('Password and confirm password do not match.');
			}
			const hashedPassword = await bcrypt.hash(password, 10);

			const userEntity = queryRunner.manager.create(User, {
				...userData,
				password: hashedPassword,
				role: (allowRole && dto.role) || Role.CUSTOMER
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

	async refreshToken(req: Request, res: Response) {
		const rawRefreshToken = readRefreshCookie(req.cookies);
		if (!rawRefreshToken) {
			throw new UnauthorizedException('Refresh token not found.');
		}

		const result = await this.authSessionService.rotateSession(
			rawRefreshToken,
			async (userId) => {
				const user = await this.userRepository.findOneByQuery({ id: userId });
				return user && !user.isDeleted ? this.toSessionUser(user) : null;
			},
			this.extractClientInfo(req)
		);

		const user = await this.userRepository.findOneByQuery({ id: result.userId });
		if (result.kind === 'rotated') {
			setSessionCookies(res, user?.role, result.tokens);
		} else {
			// Another request already rotated this session and set the new refresh cookie
			setSessionCookies(res, user?.role, { accessToken: result.accessToken });
		}

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Session refreshed.', 'data', {
			user: user ? this.toSessionUser(user) : null
		});
	}

	async logout(res: Response, req?: Request): Promise<void> {
		try {
			await this.authSessionService.revokeByRefreshToken(readRefreshCookie(req?.cookies));
		} finally {
			clearSessionCookies(res);
		}
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
		// A password reset signs the user out everywhere
		await this.authSessionService.revokeAllForUser(user.id, 'password_reset');

		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Password has been reset successfully',
			'data',
			{ success: true }
		);
	}
}
