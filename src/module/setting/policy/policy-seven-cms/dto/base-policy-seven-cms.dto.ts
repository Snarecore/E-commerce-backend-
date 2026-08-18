import { IsNotEmpty } from 'class-validator';

export class BasePolicySevenCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
