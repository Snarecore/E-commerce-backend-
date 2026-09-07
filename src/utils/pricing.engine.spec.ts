import { ProductPricingResolver } from './pricing.engine';

describe('ProductPricingResolver Enterprise Tests', () => {
    describe('resolveUnitPrice', () => {
        it('should return regular price when no discount exists', () => {
            const result = ProductPricingResolver.resolveUnitPrice({
                price: 1000,
                discountType: 'NONE',
                discountAmount: 0
            });
            expect(result).toBe(1000);
        });

        it('should correctly apply percentage discount', () => {
            const result = ProductPricingResolver.resolveUnitPrice({
                price: 1000,
                discountType: 'PERCENTAGE',
                discountAmount: 20
            });
            expect(result).toBe(800);
        });

        it('should correctly apply flat/fixed discount', () => {
            const result = ProductPricingResolver.resolveUnitPrice({
                price: 1000,
                discountType: 'FLAT',
                discountAmount: 150
            });
            expect(result).toBe(850);
        });

        it('should correctly apply combined product discount and mega discount', () => {
            const result = ProductPricingResolver.resolveUnitPrice(
                {
                    price: 1000,
                    discountType: 'PERCENTAGE',
                    discountAmount: 20 // 1000 -> 800
                },
                {
                    isActive: true,
                    discountPercentage: 10 // 800 -> 720
                }
            );
            expect(result).toBe(720);
        });

        it('should ignore inactive mega discount', () => {
            const result = ProductPricingResolver.resolveUnitPrice(
                {
                    price: 1000,
                    discountType: 'PERCENTAGE',
                    discountAmount: 20
                },
                {
                    isActive: false,
                    discountPercentage: 10
                }
            );
            expect(result).toBe(800);
        });

        it('should never return negative unit price', () => {
            const result = ProductPricingResolver.resolveUnitPrice({
                price: 100,
                discountType: 'FLAT',
                discountAmount: 200
            });
            expect(result).toBe(0);
        });
    });

    describe('calculateCartSubtotal', () => {
        it('should calculate cart subtotal identically for multiple items', () => {
            const items = [
                {
                    product: { price: 500, discountType: 'FLAT', discountAmount: 50 }, // 450 each * 2 = 900
                    quantity: 2
                },
                {
                    product: { price: 200, discountType: 'PERCENT', discountAmount: 10 }, // 180 each * 3 = 540
                    quantity: 3
                }
            ];

            const subtotal = ProductPricingResolver.calculateCartSubtotal(items, null);
            expect(subtotal).toBe(1440);
        });
    });
});
