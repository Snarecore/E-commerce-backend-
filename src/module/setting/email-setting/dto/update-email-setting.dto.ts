import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { EmailProviderType } from '../entities/email-setting.entity';
import { Type } from 'class-transformer';

export class UpdateEmailSettingDto {
    @IsOptional()
    @IsEnum(EmailProviderType)
    provider?: EmailProviderType;

    @IsNotEmpty()
    @IsString()
    host: string;

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    port: number;

    @IsOptional()
    @IsBoolean()
    secure?: boolean;

    @IsNotEmpty()
    @IsString()
    emailUser: string;

    @IsOptional()
    @IsString()
    emailPass?: string;

    @IsNotEmpty()
    @IsString()
    senderName: string;

    @IsNotEmpty()
    @IsEmail()
    senderEmail: string;

    @IsOptional()
    @IsString()
    replyTo?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
