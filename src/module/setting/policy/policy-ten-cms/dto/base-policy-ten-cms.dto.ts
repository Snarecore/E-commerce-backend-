import { IsNotEmpty } from 'class-validator';

export class BasePolicyTenCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
