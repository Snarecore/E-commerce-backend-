import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    IsNumber,
    IsEnum
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from '../../../../enums/product.enum';

function transformOptionalNumber({ value }: { value: any }) {
    if (value === '' || value === 'undefined' || value === 'null' || value === null || value === undefined) {
        return undefined;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
}

function transformOptionalInt({ value }: { value: any }) {
    if (value === '' || value === 'undefined' || value === 'null' || value === null || value === undefined) {
        return undefined;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
}

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    sku: string;

    @IsOptional()
    featuredImage?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    price: number;

    @IsOptional()
    @IsNumber()
    @Transform(transformOptionalNumber)
    cost?: number;

    @IsEnum(DiscountType)
    discountType: DiscountType = DiscountType.NONE;

    @IsOptional()
    @IsNumber()
    @Transform(transformOptionalNumber)
    discountAmount?: number;

    @IsOptional()
    @IsString()
    videoUrl?: string;

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsString()
    summary?: string;

    @IsNotEmpty()
    @IsUUID()
    mainCategoryId: string;

    @IsNotEmpty()
    @IsString()
    mainCategoryName: string;

    @IsOptional()
    firstCategoryId?: string;

    @IsOptional()
    @IsString()
    firstCategoryName?: string;

    @IsOptional()
    secondCategoryId?: string;

    @IsOptional()
    @IsString()
    secondCategoryName?: string;

    @IsOptional()
    @IsString()
    sizesString?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (!value || value === '[object Object]' || value === 'undefined' || value === 'null') {
            return undefined;
        }
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return undefined; }
        }
        return value;
    })
    sizeStock?: Record<string, number>;

    @IsOptional()
    @IsNumber()
    @Transform(transformOptionalInt)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Transform(transformOptionalInt)
    quantityAlert?: number;

    @IsOptional()
    vendorId: string;

    @IsOptional()
    vendorName: string;
}
