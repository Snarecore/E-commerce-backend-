import { PartialType } from '@nestjs/mapped-types';
import { CreateSecondCategoryDto } from './create-second-category.dto';

export class UpdateSecondCategoryDto extends PartialType(CreateSecondCategoryDto) {
    slug?: string;
}
