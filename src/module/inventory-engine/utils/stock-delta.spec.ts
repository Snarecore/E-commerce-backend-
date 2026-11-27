import { HttpException } from '@nestjs/common';
import { AdjustmentReason } from '../../../enums/stock-adjustment.enum';
import { StockMovementType } from '../../../enums/stock-movement.enum';
import { adjustmentMovementType, applyStockDelta } from './stock-delta';

const product = (quantity: number | null, sizeStock: Record<string, number> | null) => ({ name: 'Shirt', quantity, sizeStock }) as any;

describe('applyStockDelta', () => {
    it('moves the size and the total by the same amount', () => {
        expect(applyStockDelta(product(20, { M: 10 }), 'M', -3)).toEqual({
            variantBefore: 10,
            variantAfter: 7,
            totalBefore: 20,
            totalAfter: 17,
            sizeStock: { M: 7 },
        });
    });

    it('starts an unknown size at 0 instead of the product total', () => {
        expect(() => applyStockDelta(product(50, { M: 50 }), 'XXL', -1)).toThrow(HttpException);
        expect(applyStockDelta(product(50, { M: 50 }), 'XXL', 4)).toMatchObject({ variantBefore: 0, variantAfter: 4, totalAfter: 54 });
    });

    it('rejects negative results and fractional changes', () => {
        expect(() => applyStockDelta(product(1, null), null, -2)).toThrow(HttpException);
        expect(() => applyStockDelta(product(10, null), null, 1.5)).toThrow(HttpException);
    });

    it('does not mutate the product', () => {
        const p = product(5, { M: 5 });
        applyStockDelta(p, 'M', -1);
        expect(p.sizeStock).toEqual({ M: 5 });
    });
});

describe('adjustmentMovementType', () => {
    it('maps reasons for stock going out, and surplus for stock coming in', () => {
        expect(adjustmentMovementType(AdjustmentReason.THEFT, -1)).toBe(StockMovementType.ADJUSTMENT_THEFT);
        expect(adjustmentMovementType(AdjustmentReason.OTHER, -1)).toBe(StockMovementType.ADJUSTMENT_DEFICIT);
        expect(adjustmentMovementType(AdjustmentReason.DAMAGED, 3)).toBe(StockMovementType.ADJUSTMENT_SURPLUS);
    });
});
