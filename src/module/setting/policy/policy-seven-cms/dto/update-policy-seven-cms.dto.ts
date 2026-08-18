import { PartialType } from '@nestjs/mapped-types';
import { BasePolicySevenCmsDto } from './base-policy-seven-cms.dto';

export class UpdatePolicySevenCmsDto extends PartialType(BasePolicySevenCmsDto) {}
