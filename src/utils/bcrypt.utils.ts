import * as bcrypt from 'bcryptjs';

/**
 * Password hashing for the whole API. bcrypt cost 12 (≈4096 rounds): slow enough to resist
 * offline guessing of a leaked hash, fast enough for login. Existing cost-10 hashes keep
 * verifying, because bcrypt reads the cost from the hash itself.
 *
 * Async on purpose: the sync variants block Node's only thread for ~250 ms per call.
 */
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}
