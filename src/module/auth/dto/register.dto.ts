import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NewPassword, NormalizedEmail } from '../../../decorators/auth-fields.decorator';
import { Match } from '../../../decorators/match.decorator';
import { Role } from '../../../enums/role.enum';

export class RegisterDto {
    @IsNotEmpty()
    name: string;

    @NormalizedEmail()
    email: string;

    @IsNotEmpty()
    phone: string;

    @NewPassword()
    password: string;

    @IsString()
    @Match('password', { message: 'Passwords do not match.' })
    confirmPassword: string;

    @IsEnum(Role, { message: 'Invalid role value' })
    @IsOptional()
    role?: Role;
}
