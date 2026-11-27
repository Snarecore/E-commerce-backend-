import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, NotEquals } from 'class-validator';
import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';

/** Internal: one immutable stock-ledger row. Built by services, never accepted from a client. */
export interface RecordMovementDto {
    productId: string;
    variantId?: string | null;
    size?: string | null;
    sku?: string | null;
    movementType: StockMovementType;
    quantityChange: number;
    onHandBefore: number;
    onHandAfter: number;
    reservedBefore?: number;
    reservedAfter?: number;
    availableBefore?: number;
    availableAfter?: number;
    referenceType: StockReferenceType;
    referenceId?: string | null;
    idempotencyKey?: string | null;
    reason?: string | null;
    note?: string | null;
    performedBy?: string | null;
    performedByName?: string | null;
}

/** Internal: parameters for InventoryEngineService.adjustStock. Built by services/controllers. */
export interface AdjustStockParams {
    productId: string;
    size?: string | null;
    quantityChange: number;
    movementType: StockMovementType;
    referenceType: StockReferenceType;
    referenceId?: string | null;
    reason?: string | null;
    note?: string | null;
    performedBy?: string | null;
    performedByName?: string | null;
    idempotencyKey?: string | null;
}

/** Movement types an admin may record by hand; sale/return/exchange types are system-only. */
export const MANUAL_MOVEMENT_TYPES = [
    StockMovementType.MANUAL_CORRECTION,
    StockMovementType.OPENING,
    StockMovementType.ADJUSTMENT_ADDITION,
    StockMovementType.ADJUSTMENT_DAMAGE,
    StockMovementType.ADJUSTMENT_LOST,
    StockMovementType.ADJUSTMENT_THEFT,
    StockMovementType.ADJUSTMENT_SURPLUS,
    StockMovementType.ADJUSTMENT_DEFICIT,
    StockMovementType.ADJUSTMENT_SAMPLE,
] as const;

/**
 * Body of POST /inventory/adjust-single. Who performed it, the reference type and whether stock
 * may go negative are decided by the server, never by the request.
 */
export class AdjustSingleStockDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    productId: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    size?: string | null;

    @Type(() => Number)
    @IsInt()
    @NotEquals(0)
    @Min(-100000)
    @Max(100000)
    quantityChange: number;

    @IsOptional()
    @IsIn(MANUAL_MOVEMENT_TYPES)
    movementType?: StockMovementType;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    reason?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    idempotencyKey?: string | null;
}

export class QueryStockMovementsDto {
    @IsOptional()
    @IsString()
    productId?: string;

    @IsOptional()
    @IsEnum(StockMovementType)
    movementType?: StockMovementType;

    @IsOptional()
    @IsEnum(StockReferenceType)
    referenceType?: StockReferenceType;

    @IsOptional()
    @IsString()
    referenceId?: string;

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
}

export class QueryLowStockAlertsDto {
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
    @IsString()
    @MaxLength(100)
    search?: string;

    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    outOfStockOnly?: boolean;
}
