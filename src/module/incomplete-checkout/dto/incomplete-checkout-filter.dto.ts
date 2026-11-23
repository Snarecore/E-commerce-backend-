import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CheckoutStatus } from '../enums/checkout-status.enum';

export class IncompleteCheckoutFilterDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(CheckoutStatus)
    status?: CheckoutStatus;

    @IsOptional()
    @IsString()
    fromDate?: string;

    @IsOptional()
    @IsString()
    toDate?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
