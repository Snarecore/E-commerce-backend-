/**
 * Business-day boundaries for reports. Order timestamps are stored in UTC, but "27 Nov" for the
 * shop means 27 Nov in the shop's own time zone (Bangladesh, UTC+06:00, no daylight saving).
 * Configure with STORE_UTC_OFFSET (format ±HH:MM).
 */
const OFFSET_PATTERN = /^[+-](0\d|1[0-4]):[0-5]\d$/;

export function getStoreUtcOffset(): string {
    const configured = (process.env.STORE_UTC_OFFSET || '').trim();
    return OFFSET_PATTERN.test(configured) ? configured : '+06:00';
}

const toSqlDateTime = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Converts a report filter date to the UTC instant to compare `createdAt` with. A bare
 * YYYY-MM-DD means the start (or end) of that day in store time; a full ISO timestamp is used as is.
 */
export function storeDayBoundaryUtc(value: string, edge: 'start' | 'end'): string {
    if (value.includes('T')) return toSqlDateTime(new Date(value));
    const time = edge === 'start' ? '00:00:00' : '23:59:59';
    const instant = new Date(`${value}T${time}${getStoreUtcOffset()}`);
    if (Number.isNaN(instant.getTime())) throw new Error(`Invalid report date "${value}". Use YYYY-MM-DD.`);
    return toSqlDateTime(instant);
}

/** SQL expression for a UTC datetime column shifted to store local time (offset is validated). */
export function sqlInStoreTime(column: string): string {
    return `CONVERT_TZ(${column}, '+00:00', '${getStoreUtcOffset()}')`;
}

/** Store-local calendar date (YYYY-MM-DD) of a UTC instant. */
export function storeLocalDate(value: Date | string): string {
    const offset = getStoreUtcOffset();
    const sign = offset.startsWith('-') ? -1 : 1;
    const [hours, minutes] = offset.slice(1).split(':').map(Number);
    const shifted = new Date(new Date(value).getTime() + sign * (hours * 60 + minutes) * 60_000);
    return shifted.toISOString().slice(0, 10);
}
