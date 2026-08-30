import { UserInterface } from '../common/types';
import { User } from '../module/user/entities/user.entity';

export function userTransformer({
	password: _password,
	...rest
}: User): Omit<UserInterface, 'password'> {
	return rest;
}
