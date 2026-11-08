import { AdjustmentStatus, AdjustmentReason, AdjustmentMode } from '../../../enums/stock-adjustment.enum';

export interface CreateAdjustmentItemDto {
    productId: string;
    productName?: string | null;
    sku?: string | null;
    size?: string | null;
    quantity: number;
    type?: 'IN' | 'OUT';
    unitCost?: number;
}

export interface CreateAdjustmentDto {
    reason: AdjustmentReason;
    mode: AdjustmentMode;
    notes?: string | null;
    attachmentUrl?: string | null;
    items: CreateAdjustmentItemDto[];
    instantExecution?: boolean; // If true and authorized, executes immediately to COMPLETED
}

export interface QueryAdjustmentsDto {
    status?: AdjustmentStatus;
    reason?: AdjustmentReason;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}
