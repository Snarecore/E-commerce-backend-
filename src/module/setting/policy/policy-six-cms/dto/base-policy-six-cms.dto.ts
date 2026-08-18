import { IsNotEmpty } from 'class-validator';

export class BasePolicySixCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
