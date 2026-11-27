import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateProductReviewDto {
    @IsNotEmpty()
    @IsUUID()
    productId: string;

    @IsNotEmpty()
    @IsUUID()
    vendorId: string;

    /** Whole stars, 1 to 5. */
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsOptional()
    userId: string;
}
