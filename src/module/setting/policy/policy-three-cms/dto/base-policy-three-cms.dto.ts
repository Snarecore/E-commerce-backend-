import { IsNotEmpty } from 'class-validator';

export class BasePolicyThreeCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
