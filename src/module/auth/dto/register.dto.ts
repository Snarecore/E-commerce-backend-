import {
    ArrayNotEmpty,
    IsArray,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength
} from 'class-validator';
import { Match } from '../../../decorators/match.decorator';
import { Role } from '../../../enums/role.enum';

export class RegisterDto {
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    phone: string;

    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @IsString()
    @MinLength(6, { message: 'Confirm password must be at least 6 characters' })
    @Match('password')
    confirmPassword: string;

    @IsEnum(Role, { message: 'Invalid role value' })
    @IsOptional()
    role?: Role;
}
