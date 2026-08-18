import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class BaseHomePageCmsDto {
    @IsNotEmpty()
    categorySectionTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isCategorySectionVisible: boolean;

    @IsNotEmpty()
    productSectionOneTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionOneVisible: boolean;

    @IsNotEmpty()
    productSectionOneFontColor: string;

    @IsNotEmpty()
    productSectionOneBackgroundColor: string;

    @IsNotEmpty()
    productSectionTwoTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionTwoVisible: boolean;

    @IsNotEmpty()
    productSectionTwoFontColor: string;

    @IsNotEmpty()
    productSectionTwoBackgroundColor: string;

    @IsNotEmpty()
    productSectionThreeTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionThreeVisible: boolean;

    @IsNotEmpty()
    productSectionThreeFontColor: string;

    @IsNotEmpty()
    productSectionThreeBackgroundColor: string;

    @IsNotEmpty()
    productSectionFourTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionFourVisible: boolean;

    @IsNotEmpty()
    productSectionFourFontColor: string;

    @IsNotEmpty()
    productSectionFourBackgroundColor: string;

    @IsNotEmpty()
    productSectionFiveTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionFiveVisible: boolean;

    @IsNotEmpty()
    productSectionFiveFontColor: string;

    @IsNotEmpty()
    productSectionFiveBackgroundColor: string;

    @IsNotEmpty()
    productSectionSixTitle: string;

    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isProductSectionSixVisible: boolean;

    @IsNotEmpty()
    productSectionSixFontColor: string;

    @IsNotEmpty()
    productSectionSixBackgroundColor: string;

    @IsOptional()
    bannerImage: string;

    @IsOptional()
    bannerImageLink: string;
}
