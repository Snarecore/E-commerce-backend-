import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    IsNumber,
    IsEnum
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from 'src/enums/product.enum';

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
    @Transform(({ value }) => parseFloat(value))
    cost?: number;

    @IsEnum(DiscountType)
    discountType: DiscountType = DiscountType.NONE;

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
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
    @IsNumber()
    @Transform(({ value }) => parseInt(value, 10))
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value, 10))
    quantityAlert?: number;

    @IsOptional()
    vendorId: string;

    @IsOptional()
    vendorName: string;
}
