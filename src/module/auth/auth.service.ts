import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, Res, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse, ResponseUtils } from 'src/utils/response.utils';
import { User } from '../user/entities/user.entity';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { Request } from 'express';
import { JwtPayload } from 'src/common/types';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { UploadMulterFile } from '../space-module/space-service';
import { SpaceService } from '../space-module/space-service/space.service';
import { EmailService } from '../email-service/email-sender.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SesEmailService } from 'src/common/ses/ses-email.service';

@Injectable()
export class AuthService {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly userRepository: UserRepository,
		private readonly userProfileRepository: UserProfileRepository,
		private readonly jwtService: JwtService,
		private readonly spaceService: SpaceService,
		private readonly emailService: EmailService,
		private readonly sesEmailService: SesEmailService
	) { }

	async validateUser(dto: LoginDto): Promise<User> {
		const user = await this.userRepository.findOneByQuery({ email: dto.email });
		if (!user) {
			throw new NotFoundException('User not found.');
		}
		const isPasswordValid = await bcrypt.compare(dto.password, user.password);
		if (!isPasswordValid) {
			throw new UnauthorizedException('Incorrect password.');
		}
		return user;
	}

	async login(dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		const user = await this.validateUser(dto);

		const payload = { email: user.email, sub: user.id, role: user.role, name: user.name };

		const accessToken = this.jwtService.sign(payload, { expiresIn: '15d' });
		const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict'
		});

		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			token: accessToken
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

	// async login(
	//     dto: LoginDto,
	//     @Res({ passthrough: true }) res: Response
	// ): Promise<{ accessToken: string }> {
	//     const user = await this.validateUser(dto);
	//     const payload = { email: user.email, sub: user.id, role: user.role };

	//     const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
	//     const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

	//     res.cookie('refreshToken', refreshToken, {
	//         httpOnly: true,
	//         secure: true,
	//         sameSite: 'strict',
	//     });

	//     return { accessToken };
	// }

	// async findUserData(userData) {
	// 	try {
	// 		const response = await this.userRepository.findOneByQuery({ email: userData.email });
	// 		if (!response) {
	// 			throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
	// 		}

	// 		return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Data retrieved successfully.', 'data', response);
	// 	} catch (error) {
	// 		const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
	// 		throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
	// 	}
	// }

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

			const createdUser = await this.userRepository.create({
				...userData,
				password: hashedPassword,
				role: dto.role
			});

			if (createdUser) {
				await this.userProfileRepository.create({
					user: createdUser
				});
			}

			return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Data saved successfully.', 'data', createdUser);
		} catch (error) {
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

			const createdUser = await this.userRepository.create({
				...userData,
				password: hashedPassword,
				role: dto.role
			});

			if (createdUser) {
				if (createdUser) {
					await this.userProfileRepository.create({
						user: createdUser,
						shopName: shopName,
						shopImage: shopImage
					});
				}
			}

			return ResponseUtils.successResponseHandler(HttpStatus.OK, 'Data saved successfully.', 'data', createdUser);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		} finally {
			await queryRunner.release();
		}
	}

	async refreshToken(req: Request, res: Response): Promise<{ accessToken: string }> {
		const refreshToken = req.cookies['refreshToken'];
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

		const payload = { email: user.email, sub: user.id, roles: user.role };
		const newAccessToken = this.jwtService.sign(payload, { expiresIn: '15d' });
		const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

		res.cookie('refreshToken', newRefreshToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict'
		});

		return { accessToken: newAccessToken };
	}

	logout(res: Response): void {
		res.clearCookie('refreshToken', {
			httpOnly: true,
			secure: true,
			sameSite: 'strict'
		});
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

			await this.sesEmailService.sendResetPasswordEmail({
				to: [user.email],
				from: `"support" <support@bazaarbound.com>`,
				subject: 'Reset Your Password',
				username: `${user.name}`,
				token: resetToken,
				email: user.email,
				companyEmail: 'support@bazaarbound.com',
				bcc: ['sabbir.qligence@gmail.com']
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

		const user = await this.userRepository.findOneByQuery({ email: email });
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
