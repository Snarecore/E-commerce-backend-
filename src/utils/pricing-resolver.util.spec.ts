import { resolveEffectiveProductPrice } from './pricing-resolver.util';

describe('ProductPricingResolver', () => {
	it('should use individual product discount when Mega Discount is OFF', () => {
		const product = {
			price: 1000,
			discountType: 'PERCENT',
			discountAmount: 10
		};
		const megaDiscount = {
			isActive: false,
			discountPercentage: 20
		};

		const result = resolveEffectiveProductPrice(product, megaDiscount);

		expect(result.effectivePrice).toBe(900.00);
		expect(result.discountType).toBe('PERCENT');
		expect(result.discountAmount).toBe(10);
		expect(result.isMegaDiscountApplied).toBe(false);
	});

	it('should override individual discount with Mega Discount when Mega Discount is ON', () => {
		const product = {
			price: 1000,
			discountType: 'PERCENT',
			discountAmount: 10
		};
		const megaDiscount = {
			isActive: true,
			discountPercentage: 20
		};

		const result = resolveEffectiveProductPrice(product, megaDiscount);

		expect(result.effectivePrice).toBe(800.00);
		expect(result.discountType).toBe('PERCENT');
		expect(result.discountAmount).toBe(20);
		expect(result.isMegaDiscountApplied).toBe(true);
	});

	it('should auto-discount product without individual discount when Mega Discount is ON', () => {
		const product = {
			price: 1000,
			discountType: 'NONE',
			discountAmount: 0
		};
		const megaDiscount = {
			isActive: true,
			discountPercentage: 25
		};

		const result = resolveEffectiveProductPrice(product, megaDiscount);

		expect(result.effectivePrice).toBe(750.00);
		expect(result.discountType).toBe('PERCENT');
		expect(result.discountAmount).toBe(25);
		expect(result.isMegaDiscountApplied).toBe(true);
	});

	it('should handle decimal float precision correctly using Number.EPSILON rounding', () => {
		const product = {
			price: 999,
			discountType: 'NONE',
			discountAmount: 0
		};
		const megaDiscount = {
			isActive: true,
			discountPercentage: 17
		};

		const result = resolveEffectiveProductPrice(product, megaDiscount);

		expect(result.effectivePrice).toBe(829.17);
		expect(result.isMegaDiscountApplied).toBe(true);
	});
});
