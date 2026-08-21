import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from 'src/enums/product.enum';

class ProductDto {
    @IsNotEmpty()
    id: string;

    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    price: number;

    @IsNotEmpty()
    quantity: number;

    @IsOptional()
    vendorId?: string;

    @IsOptional()
    featuredImage?: string;

    @IsOptional()
    @IsEnum(DiscountType)
    discountType?: DiscountType;

    @IsOptional()
    discountAmount?: number;
}

export class CreateOrdersDto {
    @IsNotEmpty()
    paymentIntentId: string;

    @IsNumber()
    totalAmount: number;

    @IsNotEmpty()
    currency: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductDto)
    products: ProductDto[];
}
