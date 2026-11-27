import { ValueTransformer } from 'typeorm';

/**
 * Money columns are DECIMAL in MySQL/TiDB (exact, unlike FLOAT), but the driver returns DECIMAL
 * as a string. This maps it to a JS number on read and leaves writes untouched, so entities keep
 * `number` fields without silently losing paisa to binary floating point in storage.
 */
export const decimalTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | number | null) => (value === null || value === undefined ? null : Number(value)),
};
