export interface MegaDiscountState {
	isActive: boolean;
	discountPercentage: number;
}

export interface ResolvedProductPrice {
	effectivePrice: number;
	discountType: string;
	discountAmount: number;
	isMegaDiscountApplied: boolean;
}

export function resolveEffectiveProductPrice(
	product: { price: number; discountType?: string; discountAmount?: number },
	megaDiscount?: MegaDiscountState | null
): ResolvedProductPrice {
	const basePrice = Number(product.price) || 0;
	const isMegaActive = Boolean(megaDiscount?.isActive && Number(megaDiscount.discountPercentage) > 0);

	if (isMegaActive) {
		const pct = Number(megaDiscount!.discountPercentage);
		const clampPct = Math.min(Math.max(pct, 0), 100);
		const rawPrice = basePrice * (1 - clampPct / 100);
		const effectivePrice = Math.round((rawPrice + Number.EPSILON) * 100) / 100;

		return {
			effectivePrice: Math.max(0, effectivePrice),
			discountType: 'PERCENT',
			discountAmount: clampPct,
			isMegaDiscountApplied: true
		};
	}

	const discountType = product.discountType || 'NONE';
	const discountAmount = Number(product.discountAmount) || 0;
	let effectivePrice = basePrice;

	if (discountType === 'PERCENT') {
		const clampPct = Math.min(Math.max(discountAmount, 0), 100);
		const rawPrice = basePrice * (1 - clampPct / 100);
		effectivePrice = Math.round((rawPrice + Number.EPSILON) * 100) / 100;
	} else if (discountType === 'FLAT') {
		const rawPrice = basePrice - Math.max(discountAmount, 0);
		effectivePrice = Math.round((rawPrice + Number.EPSILON) * 100) / 100;
	}

	return {
		effectivePrice: Math.max(0, effectivePrice),
		discountType,
		discountAmount,
		isMegaDiscountApplied: false
	};
}
