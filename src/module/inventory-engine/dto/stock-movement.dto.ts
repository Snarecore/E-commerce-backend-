import { StockMovementType, StockReferenceType } from '../../../enums/stock-movement.enum';

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
    allowNegativeStock?: boolean;
}

export interface QueryStockMovementsDto {
    productId?: string;
    movementType?: StockMovementType;
    referenceType?: StockReferenceType;
    referenceId?: string;
    page?: number;
    limit?: number;
}

export interface QueryLowStockAlertsDto {
    page?: number;
    limit?: number;
    search?: string;
    outOfStockOnly?: boolean;
}
