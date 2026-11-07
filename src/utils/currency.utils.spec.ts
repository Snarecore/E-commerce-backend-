import { CurrencyUtils } from './currency.utils';

describe('CurrencyUtils', () => {
    it('should correctly convert valid decimal strings to BigInt minor units for supported currencies', () => {
        expect(CurrencyUtils.toMinorUnitsBigInt('100', 'USD')).toBe(10000n);
        expect(CurrencyUtils.toMinorUnitsBigInt('100.5', 'USD')).toBe(10050n);
        expect(CurrencyUtils.toMinorUnitsBigInt('100.50', 'USD')).toBe(10050n);
        expect(CurrencyUtils.toMinorUnitsBigInt('2500.99', 'BDT')).toBe(250099n);
        expect(CurrencyUtils.toMinorUnitsBigInt('0.50', 'USD')).toBe(50n);
        expect(CurrencyUtils.toMinorUnitsBigInt('1000', 'JPY')).toBe(1000n); // Zero decimal currency
        expect(CurrencyUtils.toMinorUnitsBigInt('10.500', 'KWD')).toBe(10500n); // 3 decimal currency
    });

    it('should convert to safe integer numbers for gateways', () => {
        expect(CurrencyUtils.toMinorUnitsSafeNumber('150.25', 'USD')).toBe(15025);
        expect(CurrencyUtils.toMinorUnitsSafeNumber('500', 'BDT')).toBe(50000);
    });

    it('should reject numbers, invalid strings, negative numbers, and scientific notations', () => {
        expect(() => CurrencyUtils.toMinorUnitsBigInt(100 as any, 'USD')).toThrow(/strict string/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('0', 'USD')).toThrow(/greater than zero/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('-50.00', 'USD')).toThrow(/Invalid monetary format/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('1e-7', 'USD')).toThrow(/Invalid monetary format/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('abc', 'USD')).toThrow(/Invalid monetary format/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('100,50', 'USD')).toThrow(/Invalid monetary format/);
    });

    it('should reject excess decimal precision without silent truncation', () => {
        expect(() => CurrencyUtils.toMinorUnitsBigInt('100.999', 'USD')).toThrow(/Excess decimal precision/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('100.5', 'JPY')).toThrow(/Excess decimal precision/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('10.5001', 'KWD')).toThrow(/Excess decimal precision/);
    });

    it('should reject unsupported currencies with clear security alert', () => {
        expect(() => CurrencyUtils.toMinorUnitsBigInt('100.00', 'XYZ')).toThrow(/Unsupported currency/);
        expect(() => CurrencyUtils.toMinorUnitsBigInt('100.00', '')).toThrow(/Unsupported currency/);
    });

    it('should accurately compare amounts regardless of decimal trailing zeros', () => {
        expect(CurrencyUtils.isAmountEqual('1000', '1000.00', 'USD')).toBe(true);
        expect(CurrencyUtils.isAmountEqual('1000.5', '1000.50', 'USD')).toBe(true);
        expect(CurrencyUtils.isAmountEqual('1500.25', '1500.25', 'BDT')).toBe(true);
        expect(CurrencyUtils.isAmountEqual('1500.25', '1500.26', 'BDT')).toBe(false);
    });
});
