import { IsNotEmpty } from 'class-validator';

export class BasePolicyTwelveCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
