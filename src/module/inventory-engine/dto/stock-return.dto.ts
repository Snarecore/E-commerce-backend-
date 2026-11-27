import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ProcessReturnItemDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    productId: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    productName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    sku?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    size?: string | null;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10000)
    returnedQuantity: number;

    @IsIn(['GOOD', 'DAMAGED'])
    condition: 'GOOD' | 'DAMAGED';

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string | null;
}

export class ProcessReturnDto {
    /** Order UUID or human order number (a leading # is ignored). */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    orderId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string | null;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => ProcessReturnItemDto)
    items: ProcessReturnItemDto[];
}
