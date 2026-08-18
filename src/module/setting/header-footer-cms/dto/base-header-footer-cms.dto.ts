import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

class FooterLinkDto {
	value: string;
	link: string;
}

export class BaseHeaderFooterCmsDto {
    @IsNotEmpty()
	bannerText: string;

	@IsNotEmpty()
	helpline: string;

	@IsNotEmpty()
	footerDescription: string;

	@IsNotEmpty()
	copyrightText: string;

	@IsNotEmpty()
	contactEmail: string;

	@IsNotEmpty()
	contactPhone: string;

	@IsNotEmpty()
	contactAddress: string;

	@IsOptional()
	headerLogo: string;

	@IsOptional()
	footerLogo: string;

	@IsNotEmpty()
	footerSectionTwoTitle: string;

	@IsNotEmpty()
	footerSectionThreeTitle: string;

	@IsOptional()
	@Type(() => FooterLinkDto)
	footerSectionTwo: FooterLinkDto[];

	@IsOptional()
	@Type(() => FooterLinkDto)
	footerSectionThree: FooterLinkDto[];
}
