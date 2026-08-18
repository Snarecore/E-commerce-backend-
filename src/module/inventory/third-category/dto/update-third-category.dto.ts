import { PartialType } from '@nestjs/mapped-types';
import { CreateThirdCategoryDto } from './create-third-category.dto';

export class UpdateThirdCategoryDto extends PartialType(CreateThirdCategoryDto) {
    slug?: string;
}
