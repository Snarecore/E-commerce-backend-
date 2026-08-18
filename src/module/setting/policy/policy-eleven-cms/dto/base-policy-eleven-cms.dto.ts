import { IsNotEmpty } from 'class-validator';

export class BasePolicyElevenCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
