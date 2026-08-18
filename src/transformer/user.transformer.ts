import { UserInterface } from 'src/common/types';
import { User } from 'src/module/user/entities/user.entity';

export function userTransformer({
	password: _password,
	...rest
}: User): Omit<UserInterface, 'password'> {
	return rest;
}
