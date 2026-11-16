/**
 * The single currency the store prices and charges in (ISO 4217, upper-case).
 * Orders and gateway charges always use this value; any currency a client sends is ignored,
 * so a customer can never be shown one currency and charged in another.
 */
export const getStoreCurrency = (): string => {
	const configured = (process.env.STORE_CURRENCY || '').trim().toUpperCase();
	return /^[A-Z]{3}$/.test(configured) ? configured : 'BDT';
};
