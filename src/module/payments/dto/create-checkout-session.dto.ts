import { Type } from 'class-transformer';
import {
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class LineItemDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber()
    unitAmount: number; // in cents (e.g., 2000 for $20.00)

    @IsNumber()
    quantity: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];
}

export class CreateCheckoutSessionDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LineItemDto)
    items: LineItemDto[];

    @IsString()
    @IsNotEmpty()
    currency: string;
}
