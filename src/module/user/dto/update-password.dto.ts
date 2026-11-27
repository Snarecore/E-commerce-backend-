import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPassword, PASSWORD_MAX_LENGTH } from '../../../decorators/auth-fields.decorator';
import { Match } from '../../../decorators/match.decorator';

export class UpdatePasswordDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(PASSWORD_MAX_LENGTH)
    currentPassword: string;

    @NewPassword()
    newPassword: string;

    @IsString()
    @Match('newPassword', { message: 'Passwords do not match.' })
    confirmPassword: string;
}
