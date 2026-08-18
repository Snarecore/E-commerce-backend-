export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !keys.includes(key as K))
    ) as Omit<T, K>;
}

export function omitMany<T extends object, K extends keyof T>(arr: T[] | undefined | null, keys: K[]): Omit<T, K>[] {
    return (arr ?? []).map(item => omit(item, keys));
}

type DiscountType = "NONE" | "PERCENT" | "FLAT";

export function unitAfterDiscount({
    price,
    discountType,
    discountAmount = 0
}: {
    price: number;
    discountType?: DiscountType;
    discountAmount?: number;
}): number {
    const originalPrice = Number(price) || 0;
    const discountPrice = Number(discountAmount) || 0;

    let result = originalPrice;

    if (discountType === "PERCENT") {
        const clampValue = Math.min(Math.max(discountPrice, 0), 100);
        result = originalPrice * (1 - clampValue / 100);
    } else if (discountType === "FLAT") {
        result = originalPrice - Math.max(discountPrice, 0);
    }

    return +Math.max(result, 0).toFixed(2);
}
