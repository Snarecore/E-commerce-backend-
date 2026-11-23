import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

export class TrackCheckoutCustomerDto {
    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150)
    email?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;
}

export class TrackCheckoutItemDto {
    @IsNotEmpty()
    @IsString()
    productId: string;

    @IsOptional()
    @IsString()
    variantId?: string;

    @IsOptional()
    @IsString()
    sku?: string;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    quantity: number;
}

export class TrackCheckoutUtmDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utm_source?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    utm_medium?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    utm_campaign?: string;
}

export class TrackCheckoutDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    sessionToken: string;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => TrackCheckoutCustomerDto)
    customer?: TrackCheckoutCustomerDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TrackCheckoutItemDto)
    items: TrackCheckoutItemDto[];

    @IsOptional()
    @IsString()
    @MaxLength(255)
    source?: string;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => TrackCheckoutUtmDto)
    utmParams?: TrackCheckoutUtmDto;
}
