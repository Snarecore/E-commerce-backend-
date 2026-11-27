import { HttpException, HttpStatus } from '@nestjs/common';
import { AdjustmentReason } from '../../../enums/stock-adjustment.enum';
import { StockMovementType } from '../../../enums/stock-movement.enum';
import { Product } from '../../inventory/product/entities/product.entity';

export interface StockDeltaResult {
    /** Quantity of the adjusted size (or the product total when no size is given) before / after. */
    variantBefore: number;
    variantAfter: number;
    totalBefore: number;
    totalAfter: number;
    /** sizeStock to persist (a copy; the product object is not mutated). */
    sizeStock: Record<string, number> | null;
}

/**
 * The single rule for changing a product's on-hand stock by `delta` units of one size.
 *
 * - The per-size count and the product total always move by the same amount.
 * - A size the product does not list yet starts at 0 (never at the product total).
 * - Neither the size nor the total may go below zero; the caller gets a 400 instead.
 */
export function applyStockDelta(
    product: Pick<Product, 'quantity' | 'sizeStock' | 'name'>,
    size: string | null | undefined,
    delta: number
): StockDeltaResult {
    if (!Number.isInteger(delta)) {
        throw new HttpException(`Stock change must be a whole number, got "${delta}".`, HttpStatus.BAD_REQUEST);
    }

    const totalBefore = Number(product.quantity) || 0;
    const sizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : null;
    const label = size ? `"${product.name}" size "${size}"` : `"${product.name}"`;

    let variantBefore = totalBefore;
    let nextSizeStock = sizeStock;
    if (size) {
        nextSizeStock = sizeStock ?? {};
        variantBefore = Number(nextSizeStock[size]) || 0;
        nextSizeStock[size] = variantBefore + delta;
    }

    const variantAfter = variantBefore + delta;
    const totalAfter = totalBefore + delta;
    if (variantAfter < 0 || totalAfter < 0) {
        throw new HttpException(
            `Stock change for ${label} would make stock negative (current ${variantBefore}, change ${delta}).`,
            HttpStatus.BAD_REQUEST
        );
    }

    return { variantBefore, variantAfter, totalBefore, totalAfter, sizeStock: nextSizeStock };
}

/** Ledger movement type for a stock-adjustment line. */
export function adjustmentMovementType(reason: AdjustmentReason | string, delta: number): StockMovementType {
    if (delta >= 0) return StockMovementType.ADJUSTMENT_SURPLUS;
    switch (reason) {
        case AdjustmentReason.DAMAGED:
            return StockMovementType.ADJUSTMENT_DAMAGE;
        case AdjustmentReason.LOST:
            return StockMovementType.ADJUSTMENT_LOST;
        case AdjustmentReason.THEFT:
            return StockMovementType.ADJUSTMENT_THEFT;
        case AdjustmentReason.SAMPLE_GIFT:
            return StockMovementType.ADJUSTMENT_SAMPLE;
        default:
            return StockMovementType.ADJUSTMENT_DEFICIT;
    }
}
