import { IsUUID, IsOptional, IsString, Length } from 'class-validator';

export class CreateProductCommentDto {
    @IsUUID('4')
    productId: string;

    @IsOptional()
    @IsUUID('4')
    parentId?: string;

    @IsString()
    @Length(1, 2000)
    body: string;
}
