import { PartialType } from '@nestjs/mapped-types';
import { BaseHomePageCmsDto } from './base-home-page-cms.dto';

export class UpdateHomePageCmsDto extends PartialType(BaseHomePageCmsDto) {}
