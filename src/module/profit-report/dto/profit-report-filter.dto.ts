import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProfitReportStatusScope } from '../../../enums/profit-report.enum';

export class ProfitReportFilterDto {
    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    endDate?: string;

    @IsOptional()
    @IsEnum(ProfitReportStatusScope)
    statusScope?: ProfitReportStatusScope = ProfitReportStatusScope.DELIVERED_COMPLETED;

    @IsOptional()
    @IsString()
    customStatus?: string;

    @IsOptional()
    @IsString()
    mainCategoryId?: string;

    @IsOptional()
    @IsString()
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily';

    @IsOptional()
    @IsString()
    productTab?: 'most_profitable' | 'low_margin' | 'loss_making' | 'unverified_cost' = 'most_profitable';

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;
}
