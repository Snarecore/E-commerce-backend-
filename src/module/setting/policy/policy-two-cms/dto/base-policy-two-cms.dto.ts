import { IsNotEmpty } from 'class-validator';

export class BasePolicyTwoCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
