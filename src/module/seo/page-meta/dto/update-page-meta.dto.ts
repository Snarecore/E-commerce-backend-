import { PartialType } from '@nestjs/mapped-types';
import { CreatePageMetaDto } from './create-page-meta.dto';

export class UpdatePageMetaDto extends PartialType(CreatePageMetaDto) {}
