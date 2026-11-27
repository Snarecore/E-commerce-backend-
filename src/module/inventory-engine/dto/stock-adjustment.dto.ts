import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { AdjustmentMode, AdjustmentReason, AdjustmentStatus } from '../../../enums/stock-adjustment.enum';

export class CreateAdjustmentItemDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    productId: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    size?: string | null;

    /** Units to add/remove, or the physical count for EXACT_COUNT. Cost always comes from the product. */
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(100000)
    quantity: number;

    @IsOptional()
    @IsIn(['IN', 'OUT'])
    type?: 'IN' | 'OUT';
}

export class CreateAdjustmentDto {
    @IsEnum(AdjustmentReason)
    reason: AdjustmentReason;

    @IsEnum(AdjustmentMode)
    mode: AdjustmentMode;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    attachmentUrl?: string | null;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => CreateAdjustmentItemDto)
    items: CreateAdjustmentItemDto[];

    /** Apply immediately instead of waiting for approval. */
    @IsOptional()
    @IsBoolean()
    instantExecution?: boolean;
}

export class QueryAdjustmentsDto {
    @IsOptional()
    @IsEnum(AdjustmentStatus)
    status?: AdjustmentStatus;

    @IsOptional()
    @IsEnum(AdjustmentReason)
    reason?: AdjustmentReason;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}
