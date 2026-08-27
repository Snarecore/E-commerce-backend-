export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !keys.includes(key as K))
    ) as Omit<T, K>;
}

export function omitMany<T extends object, K extends keyof T>(arr: T[] | undefined | null, keys: K[]): Omit<T, K>[] {
    return (arr ?? []).map(item => omit(item, keys));
}

import { resolveEffectiveProductPrice, MegaDiscountState } from './pricing-resolver.util';

type DiscountType = "NONE" | "PERCENT" | "FLAT";

export function unitAfterDiscount({
    price,
    discountType,
    discountAmount = 0
}: {
    price: number;
    discountType?: DiscountType;
    discountAmount?: number;
}, megaDiscount?: MegaDiscountState | null): number {
    return resolveEffectiveProductPrice({ price, discountType, discountAmount }, megaDiscount).effectivePrice;
}

