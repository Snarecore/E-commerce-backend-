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
	if (basePrice <= 0) {
		return {
			effectivePrice: 0,
			discountType: product.discountType || 'NONE',
			discountAmount: 0,
			isMegaDiscountApplied: false
		};
	}

	const dType = (product.discountType || '').trim().toUpperCase();
	const dAmount = Number(product.discountAmount) || 0;
	let priceAfterProductDiscount = basePrice;

	if (dAmount > 0) {
		if (dType === 'PERCENT' || dType.includes('PERCENTAGE')) {
			priceAfterProductDiscount = basePrice - (basePrice * dAmount) / 100;
		} else if (dType === 'FLAT' || dType.includes('FIXED') || dType.includes('AMOUNT')) {
			priceAfterProductDiscount = Math.max(0, basePrice - dAmount);
		}
	}

	const isMegaActive = Boolean(megaDiscount?.isActive && Number(megaDiscount.discountPercentage) > 0);
	let finalEffectivePrice = priceAfterProductDiscount;

	if (isMegaActive) {
		const megaPercent = Number(megaDiscount!.discountPercentage);
		const clampMega = Math.min(Math.max(megaPercent, 0), 100);
		finalEffectivePrice = finalEffectivePrice - (finalEffectivePrice * clampMega) / 100;
	}

	finalEffectivePrice = Math.max(0, Math.round((finalEffectivePrice + Number.EPSILON) * 100) / 100);

	const totalDiscountMoney = basePrice - finalEffectivePrice;
	const effectiveDiscountPct = totalDiscountMoney > 0
		? Math.round(((totalDiscountMoney / basePrice) * 100 + Number.EPSILON) * 100) / 100
		: 0;

	return {
		effectivePrice: finalEffectivePrice,
		discountType: totalDiscountMoney > 0 ? 'PERCENT' : (product.discountType || 'NONE'),
		discountAmount: effectiveDiscountPct,
		isMegaDiscountApplied: isMegaActive
	};
}

