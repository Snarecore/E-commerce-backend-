import { PartialType } from '@nestjs/mapped-types';
import { BaseContactPageCmsDto } from './base-contact-page-cms.dto';

export class UpdateContactPageCmsDto extends PartialType(BaseContactPageCmsDto) {}
