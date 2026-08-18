import { PartialType } from '@nestjs/mapped-types';
import { BaseHeaderFooterCmsDto } from './base-header-footer-cms.dto';

export class UpdateHeaderFooterCmsDto extends PartialType(BaseHeaderFooterCmsDto) {}
