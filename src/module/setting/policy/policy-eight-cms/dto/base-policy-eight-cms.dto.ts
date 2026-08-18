import { IsNotEmpty } from 'class-validator';

export class BasePolicyEightCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
