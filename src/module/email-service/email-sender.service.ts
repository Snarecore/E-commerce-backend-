import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ResetPasswordMailDto } from './dto/create-reset-password-email.dto';

@Injectable()
export class EmailService {
	constructor(private readonly mailerService: MailerService) { }

	async sendResetPasswordEmail(dto: ResetPasswordMailDto): Promise<{ message: string }> {
		const { to, from, subject, username, token, companyEmail } = dto;

		await this.mailerService
			.sendMail({
				to: to,
				bcc: ['sabbir.qligence@gmail.com'],
				from: from,
				subject: subject,
				template: 'forgot_password_email',
				context: {
					username: username,
					token: token,
					email: to,
					passwordResetURL: process.env.PASSWORD_RESET_PAGE,
					companyEmail: companyEmail
				}
			})
			.catch((error: undefined) => {
				return error;
			});
		return {
			message: `Mail sent to: ${to[0]}`
		};
	}
}
