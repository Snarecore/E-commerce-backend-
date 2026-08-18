import { IsNotEmpty } from 'class-validator';

export class BasePolicyOneCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
