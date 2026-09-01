import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreatePopupDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsString()
    link?: string;

    @IsOptional()
    @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : 0))
    @IsInt()
    priority?: number;

    @IsOptional()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @Transform(({ value }) => (value === 'true' || value === true || value === 1 || value === '1' ? true : false))
    @IsBoolean()
    isActive?: boolean;
}
