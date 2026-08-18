import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class FilterDto {
    @IsOptional()
    @Transform(({ value }: { value: string }) => parseInt(value, 10))
    page?: number;

    @IsOptional()
    @Transform(({ value }: { value: string }) => parseInt(value, 10))
    limit?: number;

    @IsOptional()
    @IsString()
    searchKeyword?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @Transform(({ value }) => new Date(value))
    @IsDate()
    startDate?: Date;
  
    @IsOptional()
    @Transform(({ value }) => new Date(value))
    @IsDate()
    endDate?: Date;
}
