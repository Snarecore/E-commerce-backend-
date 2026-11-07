const SUPPORTED_CURRENCIES: Record<string, number> = {
    USD: 2,
    BDT: 2,
    EUR: 2,
    GBP: 2,
    CAD: 2,
    AUD: 2,
    JPY: 0,
    KWD: 3,
    BHD: 3,
    OMR: 3,
};

export class CurrencyUtils {
    /**
     * Converts a strictly formatted positive monetary string to minor units (e.g. cents, paisa) using BigInt.
     * - Requires amount to be a strict string (strictly no JS floats to prevent precision degradation).
     * - Rejects negative amounts, zero, commas, scientific notation, and non-numeric characters.
     * - Strictly validates decimal places against currency exponent: excess precision throws an error (never silently sliced).
     * - Rejects unsupported currencies (no default fallback).
     */
    static toMinorUnitsBigInt(amount: string, currency: string = 'BDT'): bigint {
        if (typeof amount !== 'string') {
            throw new Error(`[Security Alert] Amount must be a strict string, received ${typeof amount}`);
        }

        const normalizedAmount = amount.trim();
        const curr = String(currency || '').trim().toUpperCase();

        const exponent = SUPPORTED_CURRENCIES[curr];
        if (exponent === undefined) {
            throw new Error(
                `[Security Alert] Unsupported currency: "${currency}". Supported: ${Object.keys(SUPPORTED_CURRENCIES).join(', ')}`
            );
        }

        // Strict positive decimal string validation (no signs, no scientific notation, no trailing garbage)
        if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalizedAmount)) {
            throw new Error(
                `[Security Alert] Invalid monetary format: "${normalizedAmount}". Must be a non-negative decimal string.`
            );
        }

        const [whole, fraction = ''] = normalizedAmount.split('.');

        // Strict validation: Excess decimal precision check! E.g. '10.999' for USD must fail!
        if (fraction.length > exponent) {
            throw new Error(
                `[Security Alert] Excess decimal precision for ${curr}: received "${fraction}" (${fraction.length} decimals), maximum allowed is ${exponent}.`
            );
        }

        const paddedFraction = fraction.padEnd(exponent, '0');
        const multiplier = 10n ** BigInt(exponent);
        const minorUnits = BigInt(whole) * multiplier + (exponent > 0 ? BigInt(paddedFraction) : 0n);

        if (minorUnits <= 0n) {
            throw new Error(`[Security Alert] Monetary amount must be strictly greater than zero`);
        }

        return minorUnits;
    }

    /**
     * Converts to minor units and validates that it does not exceed Number.MAX_SAFE_INTEGER
     * for gateways requiring integer numbers (like Stripe unit amounts).
     */
    static toMinorUnitsSafeNumber(amount: string, currency: string = 'BDT'): number {
        const minorUnits = this.toMinorUnitsBigInt(amount, currency);
        if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error(
                `[Security Alert] Amount in minor units (${minorUnits}) exceeds Number.MAX_SAFE_INTEGER.`
            );
        }
        return Number(minorUnits);
    }

    /**
     * Backwards-compatible alias for BDT/Paisa.
     */
    static toPaisa(amount: string): bigint {
        return this.toMinorUnitsBigInt(amount, 'BDT');
    }

    /**
     * Exact comparison between Authoritative DB amount and Gateway response amount.
     */
    static isAmountEqual(dbAmount: string, gatewayAmount: string, currency: string = 'BDT'): boolean {
        return this.toMinorUnitsBigInt(dbAmount, currency) === this.toMinorUnitsBigInt(gatewayAmount, currency);
    }

    /**
     * Converts integer Paisa/minor units back to a standardized 2-decimal string (e.g. 150000n -> "1500.00")
     */
    static fromPaisaToString(paisa: bigint): string {
        const whole = paisa / 100n;
        const fraction = (paisa % 100n).toString().padStart(2, '0');
        return `${whole}.${fraction}`;
    }
}
