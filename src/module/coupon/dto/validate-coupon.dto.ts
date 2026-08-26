import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class CartItemDto {
    @IsNotEmpty()
    @IsString()
    productId: string;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    quantity: number;
}

export class ValidateCouponDto {
    @IsNotEmpty()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    code: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CartItemDto)
    items: CartItemDto[];

    @IsOptional()
    @IsString()
    deliveryZone?: string;
}
