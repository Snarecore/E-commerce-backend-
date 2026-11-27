import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail, PASSWORD_MAX_LENGTH } from '../../../decorators/auth-fields.decorator';

export class LoginDto {
	@NormalizedEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(PASSWORD_MAX_LENGTH)
	password: string;
}
