import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from 'src/enums/product.enum';

export class OrderItemDto {
    @IsOptional()
    @IsString()
    productId?: string;

    @IsOptional()
    @IsString()
    product?: string;

    @IsOptional()
    @IsString()
    id?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    productName?: string;

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsNotEmpty()
    @IsNumber()
    quantity: number;

    @IsOptional()
    @IsString()
    vendorId?: string;

    @IsOptional()
    @IsString()
    featuredImage?: string;

    @IsOptional()
    discountType?: any;

    @IsOptional()
    @IsNumber()
    discountAmount?: number;
}

export class ShippingAddressDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    city?: string;
}

export class CreateOrdersDto {
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @IsOptional()
    @IsString()
    paymentIntentId?: string;

    @IsOptional()
    @IsString()
    stripeSessionId?: string;

    @IsOptional()
    @IsString()
    paymentIntent?: string;

    @IsOptional()
    @IsNumber()
    totalAmount?: number;

    @IsOptional()
    @IsNumber()
    subtotal?: number;

    @IsOptional()
    @IsNumber()
    deliveryCharge?: number;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    products?: OrderItemDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items?: OrderItemDto[];

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ShippingAddressDto)
    shippingAddress?: ShippingAddressDto;

    @IsOptional()
    @IsString()
    specialNote?: string;

    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}
