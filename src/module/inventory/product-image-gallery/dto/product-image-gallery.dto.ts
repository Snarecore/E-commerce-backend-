import {
    IsNotEmpty,
    IsString,
    IsUUID
} from 'class-validator';

export class ProductImageGalleryDto {
    @IsNotEmpty()
    @IsUUID()
    productId: string;

    @IsNotEmpty()
    @IsString()
    imageUrl: string;
}
