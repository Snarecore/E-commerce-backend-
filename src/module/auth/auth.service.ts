import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { hashPassword, verifyPassword } from '../../utils/bcrypt.utils';
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
import { isDuplicateKeyError } from '../../utils/db-errors.util';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/constants/audit-action.enum';
import { AuditModule } from '../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../audit-log/constants/audit-target-type.enum';
import { getClientIp } from '../../utils/request-ip.util';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
/** bcrypt hash of a random string; compared against when the email is unknown to equalise timing. */
const DUMMY_PASSWORD_HASH = '$2b$12$1aWOiYchhOYJb.u9jLLwsOnQnk23QDZli47phe9lfgDYm6POgONtu';

@Injectable()
export class AuthService {
	/** Wrong guesses allowed per reset code before it is invalidated (1 in 180,000 odds). */
	static readonly MAX_RESET_ATTEMPTS = 5;
	/** A reset code (and the guess budget of its window) lives this long after it is issued. */
	static readonly RESET_CODE_TTL_MS = 10 * 60 * 1000;
	/** Minimum gap between two reset emails to the same account. */
	static readonly RESET_RESEND_COOLDOWN_MS = 60 * 1000;

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
		const ipAddress = getClientIp(req);
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
			// Same work and same answer as a wrong password, so login cannot reveal which emails exist
			await verifyPassword(dto.password, DUMMY_PASSWORD_HASH);
			throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
		}
		const isPasswordValid = await verifyPassword(dto.password, user.password);
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
			throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
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
		const tokens = await this.startSession(user, res, req);

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Login successful.', 'data', {
			user: this.toSessionUser(user),
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		});
	}

	private toSessionUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'>): SessionUser {
		return { id: user.id, name: user.name, email: user.email, role: user.role };
	}

	/** Creates a refresh session and writes both auth cookies, and returns tokens for environments where third-party cookies are blocked. */
	private async startSession(user: Pick<User, 'id' | 'name' | 'email' | 'role'>, res: Response, req?: Request): Promise<{ accessToken: string; refreshToken?: string }> {
		const tokens = await this.authSessionService.createSession(this.toSessionUser(user), this.extractClientInfo(req));
		setSessionCookies(res, user.role, tokens);
		return tokens;
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

		let user = await this.userRepository.findOneByQueryRelation(
			{ email },
			{ select: ['id', 'name', 'email', 'role', 'emailVerifiedAt'] }
		);
		let isNewUser = false;
		let securedUnverifiedAccount = false;
		if (!user) {
			// A deactivated account still owns its email; signing in must not mint a second account.
			const existing = await this.userRepository.findOneByQueryIncludingDeleted({ email });
			if (existing) {
				throw new UnauthorizedException('This account has been deactivated. Please contact support.');
			}
			try {
				user = await this.userRepository.create({
					email,
					name,
					password: await hashPassword(crypto.randomBytes(32).toString('hex')),
					phone: 'N/A',
					role: Role.CUSTOMER,
					emailVerifiedAt: new Date()
				});
				isNewUser = true;
			} catch (error) {
				// A concurrent first sign-in created the account a moment ago; use that one.
				if (!isDuplicateKeyError(error)) throw error;
				user = await this.userRepository.findOneByQueryRelation({ email });
				if (!user) throw error;
			}
		}

		if (!isNewUser && !user.emailVerifiedAt) {
			// First proof that this person owns the email. The account was created without that
			// proof, possibly by someone else (pre-account takeover): their password and sessions
			// must stop working. The owner can set a password later via "forgot password".
			await this.userRepository.update(user.id, {
				password: await hashPassword(crypto.randomBytes(32).toString('hex')),
				emailVerifiedAt: new Date()
			});
			await this.authSessionService.revokeAllForUser(user.id, 'email_ownership_verified');
			securedUnverifiedAccount = true;
		}

		const tokens = await this.startSession(user, res, req);

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
				after: { authProvider: 'Google/Firebase', email: user.email, isNewUser, securedUnverifiedAccount }
			}
		});

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Google login successful.', 'data', {
			user: this.toSessionUser(user),
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			// Tells the client to explain that the old password no longer works
			passwordReset: securedUnverifiedAccount,
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
		if (!currentUser?.id || !currentUser?.sessionId) {
			throw new UnauthorizedException('Not authenticated.');
		}
		const token = this.authSessionService.signSocketToken(this.toSessionUser(currentUser), currentUser.sessionId);
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
			const hashedPassword = await hashPassword(password);

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
			// Two concurrent sign-ups (e.g. a double-clicked submit) both pass the lookup above;
			// the unique email index rejects the second one.
			if (isDuplicateKeyError(error)) {
				throw new ConflictException('Email already exists.');
			}
			// HttpExceptions keep their status; anything else is logged and masked by the global filter
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	async refreshToken(req: Request, res: Response) {
		const rawRefreshToken = readRefreshCookie(req);
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

		const accessToken = result.kind === 'rotated' ? result.tokens.accessToken : result.accessToken;
		const refreshToken = result.kind === 'rotated' ? result.tokens.refreshToken : rawRefreshToken;

		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Session refreshed.', 'data', {
			user: user ? this.toSessionUser(user) : null,
			accessToken,
			refreshToken,
		});
	}

	async logout(res: Response, req?: Request): Promise<void> {
		try {
			await this.authSessionService.revokeByRefreshToken(readRefreshCookie(req));
		} finally {
			clearSessionCookies(res);
		}
	}

	async forgotPassword(email: string) {
		try {
			const cleanEmail = (email || '').trim().toLowerCase();
			// resetTokenExpiry is select:false on the entity, so it must be requested explicitly
			const user = await this.userRepository.findOneByQueryRelation(
				{ email: cleanEmail },
				{ select: ['id', 'name', 'email', 'resetTokenExpiry'] }
			);

			if (!user) {
				return ResponseUtils.successResponseHandler(
					HttpStatus.OK,
					'If your email is registered, a password reset code has been sent.',
					'data',
					{ sent: true }
				);
			}

			// One reset window lasts RESET_CODE_TTL_MS from the latest code. Requesting a new code
			// inside a live window does not refill the guess budget (otherwise "request, guess 5×,
			// repeat" would be unlimited), and a code requested within a minute of the previous one
			// is not sent at all, so nobody can flood the owner's inbox.
			const now = Date.now();
			const windowExpiry = user.resetTokenExpiry ? new Date(user.resetTokenExpiry).getTime() : 0;
			const windowOpen = windowExpiry > now;
			if (windowOpen && now - (windowExpiry - AuthService.RESET_CODE_TTL_MS) < AuthService.RESET_RESEND_COOLDOWN_MS) {
				return ResponseUtils.successResponseHandler(
					HttpStatus.OK,
					'If your email is registered, a password reset code has been sent to your email.',
					'data',
					{ sent: true }
				);
			}

			// CSPRNG, not Math.random: the code is the only secret guarding the account.
			const resetToken = crypto.randomInt(100000, 1000000).toString();
			const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

			await this.userRepository.update(user.id, {
				resetToken: hashedResetToken,
				resetTokenExpiry: new Date(now + AuthService.RESET_CODE_TTL_MS),
				...(windowOpen ? {} : { resetAttempts: 0 })
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

		if (newPassword !== confirmPassword) {
			throw new BadRequestException('Passwords do not match.');
		}

		// One message for unknown email, missing, expired or wrong code, so this endpoint
		// cannot be used to discover which emails are registered.
		const invalidCode = new BadRequestException('Invalid or expired reset code. Please request a new one.');

		const user = await this.userRepository.findOneByQueryRelation(
			{ email: cleanEmail },
			{ select: ['id', 'email', 'resetToken', 'resetTokenExpiry'] }
		);
		if (!user || !user.resetToken || !user.resetTokenExpiry) {
			throw invalidCode;
		}

		if (new Date(user.resetTokenExpiry) < new Date()) {
			throw invalidCode;
		}

		// Spend one attempt before comparing. The conditional UPDATE is atomic, so parallel
		// guesses cannot slip past the limit; once it is reached the code is burned.
		const consumed = await this.userRepository
			.createQueryBuilder()
			.update(User)
			.set({ resetAttempts: () => '`resetAttempts` + 1' })
			.where('id = :id AND `resetAttempts` < :max', { id: user.id, max: AuthService.MAX_RESET_ATTEMPTS })
			.execute();
		if (!consumed.affected) {
			// Burn the code but keep the window's expiry, so requesting a new code right away does
			// not grant a fresh set of guesses (see forgotPassword)
			await this.userRepository.update(user.id, { resetToken: null as any });
			throw new BadRequestException('Too many incorrect attempts. Please request a new reset code.');
		}

		const hashedIncomingToken = crypto.createHash('sha256').update(cleanToken).digest('hex');
		const matches =
			hashedIncomingToken.length === user.resetToken.length &&
			crypto.timingSafeEqual(Buffer.from(hashedIncomingToken), Buffer.from(user.resetToken));
		if (!matches) {
			throw invalidCode;
		}

		const hashedPassword = await hashPassword(newPassword);
		await this.userRepository.update(user.id, {
			resetToken: null as any,
			resetTokenExpiry: null as any,
			resetAttempts: 0,
			password: hashedPassword,
			// The reset code reached this inbox, which proves the person controls the email
			emailVerifiedAt: new Date()
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
