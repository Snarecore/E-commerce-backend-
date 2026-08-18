import { IsOptional, IsString } from 'class-validator';

export class CreateOrUpdateProductSeoDto {
    @IsOptional()
    @IsString()
    metaTitle?: string;

    @IsOptional()
    @IsString()
    metaDescription?: string;

    @IsOptional()
    @IsString()
    metaKeywords?: string;

    @IsOptional()
    productId: string;

    @IsOptional()
    productName: string;

    @IsOptional()
    productImage: string;
}
