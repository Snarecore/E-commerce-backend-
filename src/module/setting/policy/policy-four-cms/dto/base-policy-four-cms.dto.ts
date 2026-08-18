import { IsNotEmpty } from 'class-validator';

export class BasePolicyFourCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
