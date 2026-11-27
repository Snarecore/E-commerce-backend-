import { NormalizedEmail } from '../../../decorators/auth-fields.decorator';

export class ForgotPasswordDto {
	@NormalizedEmail()
	email: string;
}
