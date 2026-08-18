import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateProductReviewStatusDto {
    @IsNotEmpty()
    @IsUUID()
    reviewId: string;

    @IsNotEmpty()
    @IsBoolean()
    isApprove: boolean;
}
