import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FilterDto } from 'src/module/core/dto/filter.dto';

export class CommentFilterDto extends FilterDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    replyLimit?: number;
}