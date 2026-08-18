import { IsNotEmpty } from 'class-validator';

export class BaseContactPageCmsDto {
    @IsNotEmpty()
	pageTitle: string;

	@IsNotEmpty()
	pageSubTitle: string;

	@IsNotEmpty()
	phone: string;

	@IsNotEmpty()
	email: string;

	@IsNotEmpty()
	address: string;

	@IsNotEmpty()
	formSectionTitleOne: string;

	@IsNotEmpty()
	formSectionTitleTwo: string;

	@IsNotEmpty()
	formSectionTitleThree: string;

	@IsNotEmpty()
	buttonText: string;
}
