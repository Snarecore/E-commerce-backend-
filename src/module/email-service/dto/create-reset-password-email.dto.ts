export class ResetPasswordMailDto {
	to: [string];
	from: string;
	subject: string;
	username: string;
	token: string;
	email: string;
	companyEmail?: string;
}
