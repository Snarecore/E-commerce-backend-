import { FilterDto } from "src/module/core/dto/filter.dto";
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from "class-transformer";

export class ProductFilterDto extends FilterDto {
    @IsOptional()
    mainCategoryId?: string;

    @IsOptional()
    firstCategoryId?: string;

    @IsOptional()
    secondCategoryId?: string;

    @IsOptional()
    thirdCategoryId?: string;

    @IsOptional()
    vendorId?: string;

    @IsOptional()
    sku?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isApprove?: boolean;

    @IsOptional()
    @Transform(({ value }: { value: string }) => parseInt(value, 10))
    maxTotal?: number;
}
