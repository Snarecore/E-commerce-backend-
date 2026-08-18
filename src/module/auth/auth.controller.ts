import { Body, Controller, Get, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CONFIG } from 'src/utils/config';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse } from 'src/utils/response.utils';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { RefreshAuthGuard } from 'src/guards/refresh-auth.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Public } from 'src/decorators/public.decorator';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from '../space-module/space-service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller({ path: "auth", version: CONFIG.API_VERSION })
export class AuthController {
	constructor(private readonly authService: AuthService) { }

	@Public()
	@Post('register')
	async register(@Body() dto: RegisterDto): Promise<ApiResponse<User>> {
		return await this.authService.register(dto);
	}

	@Public()
	@Post('vendor-register')
	@UseInterceptors(FileFieldsInterceptor([{ name: 'shopImage', maxCount: 1 }]))
	async vendorRegister(
		@Body() dto: VendorRegisterDto,
		@UploadedFiles()
		files: {
			shopImage?: UploadMulterFile;
		}
	): Promise<ApiResponse<User>> {
		return await this.authService.vendorRegister(dto, files);
	}

	@Public()
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) res: Response
	) {
		return await this.authService.login(dto, res);
	}

	// @Public()
	// @Post('login')
	// async login(
	//     @Body() dto: LoginDto,
	//     @Res({ passthrough: true }) res: Response
	// ): Promise<{ accessToken: string }> {
	//     return await this.authService.login(dto, res);
	// }

	// @UseGuards(JwtAuthGuard, RolesGuard)
	// @Get('/user-info')
	// async findUserData(@Req() req: Request) {
	// 	return await this.authService.findUserData(req.user);
	// }

	@Public()
	@Post('refresh-token')
	@UseGuards(RefreshAuthGuard)
	async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ accessToken: string }> {
		return this.authService.refreshToken(req, res);
	}

	@Public()
	@Post('logout')
	@UseGuards(JwtAuthGuard)
	logout(@Res({ passthrough: true }) res: Response): Response {
		this.authService.logout(res);
		return res.json({ message: 'Logged out successfully.' });
	}

	@Public()
	@Post('forgot-password')
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.forgotPassword(dto.email);
	}

	@Public()
	@Post('reset-password')
	async resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}
}
