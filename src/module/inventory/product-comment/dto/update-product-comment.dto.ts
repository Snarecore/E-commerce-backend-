import { IsString, Length } from 'class-validator';
export class UpdateProductCommentDto {
    @IsString()
    @Length(1, 2000)
    body: string;
}