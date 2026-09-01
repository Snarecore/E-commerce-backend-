import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class PopupFilterDto {
    @IsOptional()
    @Transform(({ value }) => (value ? Number(value) : 1))
    @IsInt()
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => (value ? Number(value) : 10))
    @IsInt()
    limit?: number = 10;

    @IsOptional()
    @IsString()
    search?: string;
}
