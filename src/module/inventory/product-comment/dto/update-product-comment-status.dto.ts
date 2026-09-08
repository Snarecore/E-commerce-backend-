import { IsBoolean } from 'class-validator';

export class UpdateProductCommentStatusDto {
    @IsBoolean()
    isApproved: boolean;
}
