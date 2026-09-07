export interface PricingItem {
    price: number;
    discountType?: string | null;
    discountAmount?: number | null;
}

export interface MegaDiscountRecord {
    isActive?: boolean | null;
    discountPercentage?: number | string | null;
}

export class ProductPricingResolver {
    /**
     * Resolves the effective unit price of a single product item after
     * applying product-level discount and singleton mega discount.
     */
    static resolveUnitPrice(item: PricingItem, megaDiscount?: MegaDiscountRecord | null): number {
        const rawPrice = Number(item?.price) || 0;
        let priceAfterProductDiscount = rawPrice;

        const dType = (item?.discountType || '').trim().toUpperCase();
        const dAmount = Number(item?.discountAmount) || 0;

        if (dAmount > 0) {
            if (dType === 'PERCENT' || dType.includes('PERCENTAGE')) {
                priceAfterProductDiscount = rawPrice - (rawPrice * dAmount) / 100;
            } else if (dType === 'FLAT' || dType.includes('FIXED') || dType.includes('AMOUNT')) {
                priceAfterProductDiscount = Math.max(0, rawPrice - dAmount);
            }
        }

        if (megaDiscount?.isActive && Number(megaDiscount?.discountPercentage) > 0) {
            const megaPercent = Number(megaDiscount.discountPercentage);
            priceAfterProductDiscount = priceAfterProductDiscount - (priceAfterProductDiscount * megaPercent) / 100;
        }

        return Math.max(0, Number(priceAfterProductDiscount.toFixed(2)));
    }

    /**
     * Calculates the subtotal for a list of cart/order items using the resolved unit price.
     */
    static calculateCartSubtotal(
        items: Array<{ product: PricingItem; quantity: number }>,
        megaDiscount?: MegaDiscountRecord | null
    ): number {
        const total = items.reduce((sum, item) => {
            const unit = this.resolveUnitPrice(item.product, megaDiscount);
            return sum + unit * (Number(item.quantity) || 1);
        }, 0);
        return Number(total.toFixed(2));
    }
}
