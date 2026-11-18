import { Body, Controller, Get, HttpStatus, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CONFIG } from '../../utils/config';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { RefreshAuthGuard } from '../../guards/refresh-auth.guard';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Public } from '../../decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';

@Controller({ path: "auth", version: CONFIG.API_VERSION })
export class AuthController {
	constructor(private readonly authService: AuthService) { }

	@Public()
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Post('register')
	async register(
		@Body() dto: RegisterDto,
		@Req() req: Request
	): Promise<ApiResponse<User>> {
		return await this.authService.register(dto, req);
	}

	@Roles(Role.ADMIN)
	@Post('admin/register')
	async adminRegister(
		@Body() dto: RegisterDto,
		@Req() req: Request
	): Promise<ApiResponse<User>> {
		return await this.authService.register(dto, req, true);
	}

	@Public()
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request
	) {
		return await this.authService.login(dto, res, req);
	}

	@Public()
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Post('firebase-login')
	async firebaseLogin(
		@Body() dto: FirebaseLoginDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request
	) {
		return await this.authService.firebaseLogin(dto, res, req);
	}

	@UseGuards(JwtAuthGuard)
	@Roles(Role.CUSTOMER)
	@Get('me')
	async me(@Req() req: any) {
		return await this.authService.me(req.user);
	}

	@UseGuards(JwtAuthGuard)
	@Roles(Role.CUSTOMER)
	@Get('customer/me')
	async customerMe(@Req() req: any) {
		return await this.authService.me(req.user);
	}

	@UseGuards(JwtAuthGuard)
	@Roles(Role.ADMIN)
	@Get('admin/me')
	async adminMe(@Req() req: any) {
		return await this.authService.me(req.user);
	}

	@UseGuards(JwtAuthGuard)
	@Roles(Role.CUSTOMER)
	@Get('socket-token')
	socketToken(@Req() req: any) {
		return this.authService.issueSocketToken(req.user);
	}

	@Public()
	@Post('refresh-token')
	@UseGuards(RefreshAuthGuard)
	async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		return this.authService.refreshToken(req, res);
	}

	@Public()
	@Post('logout')
	async logout(
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request
	) {
		await this.authService.logout(res, req);
		return ResponseUtils.successResponseHandler(
			HttpStatus.OK,
			'Logged out successfully.'
		);
	}

	@Public()
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Post('forgot-password')
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.forgotPassword(dto.email);
	}

	@Public()
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Post('reset-password')
	async resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}
}
