import {
    IsNotEmpty,
    IsString,
    IsUUID,
    IsNumber,
    IsOptional
} from 'class-validator';

export class CreateProductReviewDto {
    @IsNotEmpty()
    @IsUUID()
    productId: string;

    @IsNotEmpty()
    @IsUUID()
    vendorId: string;

    @IsNotEmpty()
    @IsNumber()
    rating: number;  

    @IsOptional()
    userId: string;
}
