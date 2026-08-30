import { FilterDto } from "../../../core/dto/filter.dto";
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from "class-transformer";

export class ProductFilterDto extends FilterDto {
    @IsOptional()
    mainCategoryId?: string;

    @IsOptional()
    firstCategoryId?: string;

    @IsOptional()
    secondCategoryId?: string;

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

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    discountOnly?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    inStockOnly?: boolean;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return undefined;
        const val = parseFloat(value);
        return isNaN(val) ? undefined : val;
    })
    @IsNumber()
    minPrice?: number;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return undefined;
        const val = parseFloat(value);
        return isNaN(val) ? undefined : val;
    })
    @IsNumber()
    maxPrice?: number;

    @IsOptional()
    @IsString()
    sortBy?: string;
}
