import { IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
    @IsNotEmpty()
    newPassword: string;

    @IsNotEmpty()
    confirmPassword: string;

    @IsNotEmpty()
    token: string;

    @IsNotEmpty()
    email: string;
}
