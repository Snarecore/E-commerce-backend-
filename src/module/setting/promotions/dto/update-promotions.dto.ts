import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionsDto } from './create-promotions.dto';

export class UpdatePromotionsDto extends PartialType(CreatePromotionsDto) {}
