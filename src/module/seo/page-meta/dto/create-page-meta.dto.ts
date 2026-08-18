import { IsNotEmpty } from 'class-validator';

export class CreatePageMetaDto {
    @IsNotEmpty()
    page: string;

    @IsNotEmpty()
    metaTitle: string;

    @IsNotEmpty()
    metaDescription: string;

    @IsNotEmpty()
    metaKeywords: string;
}
