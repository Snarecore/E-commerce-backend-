import * as bcrypt from 'bcryptjs';

function genSalt(): string {
	return bcrypt.genSaltSync(10);
}

export function hashPassword(password: string): string {
	const salt = genSalt();
	const hash = bcrypt.hashSync(password, salt);
	return hash;
}

export function compareHash(password: string, hashPass: string): boolean {
	const compare = bcrypt.compareSync(password, hashPass);
	return compare;
}
