import { resolveEffectiveProductPrice } from './pricing-resolver.util';

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
        const megaState = megaDiscount ? {
            isActive: Boolean(megaDiscount.isActive),
            discountPercentage: Number(megaDiscount.discountPercentage || 0)
        } : null;

        const resolved = resolveEffectiveProductPrice({
            price: Number(item?.price) || 0,
            discountType: item?.discountType || undefined,
            discountAmount: Number(item?.discountAmount) || 0
        }, megaState);

        return resolved.effectivePrice;
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

