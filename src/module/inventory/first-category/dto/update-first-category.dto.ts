import { PartialType } from '@nestjs/mapped-types';
import { CreateFirstCategoryDto } from './create-first-category.dto';

export class UpdateFirstCategoryDto extends PartialType(CreateFirstCategoryDto) {
    slug?: string;
}
