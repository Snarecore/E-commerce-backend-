import {
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Min,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from '../../../enums/product.enum';

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
    @IsInt()
    @Min(1)
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

    @IsOptional()
    @IsString()
    size?: string;

    @IsOptional()
    @IsString()
    selectedSize?: string;
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

    @IsOptional()
    @IsString()
    email?: string;
}

export class CreateOrdersDto {
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    // Legacy payment-method marker only ('COD' | 'SSLCOMMERZ' | 'PENDING_STRIPE').
    // Gateway IDs are never accepted here: online payments start after the order exists.
    @IsOptional()
    @IsString()
    paymentIntentId?: string;

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
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    customerEmail?: string;

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

    @IsOptional()
    @IsString()
    couponCode?: string;

    @IsOptional()
    @IsString()
    verificationId?: string;

    @IsOptional()
    @IsString()
    firebaseIdToken?: string;

    @IsOptional()
    @IsString()
    otpCode?: string;

    @IsOptional()
    @IsString()
    checkoutSessionToken?: string;
}
