import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPassword, NormalizedEmail } from '../../../decorators/auth-fields.decorator';
import { Match } from '../../../decorators/match.decorator';

export class ResetPasswordDto {
    @NewPassword()
    newPassword: string;

    @IsString()
    @Match('newPassword', { message: 'Passwords do not match.' })
    confirmPassword: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    token: string;

    @NormalizedEmail()
    email: string;
}
