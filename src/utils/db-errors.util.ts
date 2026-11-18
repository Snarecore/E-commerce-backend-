/** True when a MySQL/TiDB write failed on a UNIQUE or PRIMARY KEY constraint (errno 1062). */
export function isDuplicateKeyError(error: unknown): boolean {
	const err = error as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } } | null;
	if (!err) return false;
	return (
		err.code === 'ER_DUP_ENTRY' ||
		err.errno === 1062 ||
		err.driverError?.code === 'ER_DUP_ENTRY' ||
		err.driverError?.errno === 1062
	);
}
