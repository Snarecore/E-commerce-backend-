import { IsNotEmpty } from 'class-validator';

export class BasePolicyFiveCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
