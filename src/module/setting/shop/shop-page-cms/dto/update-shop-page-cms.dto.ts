import { PartialType } from '@nestjs/mapped-types';
import { BaseShopPageCmsDto } from './base-shop-page-cms.dto';

export class UpdateShopPageCmsDto extends PartialType(BaseShopPageCmsDto) {}
