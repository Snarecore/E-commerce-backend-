import { IsNotEmpty } from 'class-validator';

export class BasePolicyNineCmsDto {
	@IsNotEmpty()
	title: string;

	@IsNotEmpty()
	description: string;
}
