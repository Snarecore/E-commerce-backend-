import { PartialType } from '@nestjs/mapped-types';
import { BaseCommissionRateCmsDto } from './base-commission-rate-cms.dto';

export class UpdateCommissionRateCmsDto extends PartialType(BaseCommissionRateCmsDto) {}
