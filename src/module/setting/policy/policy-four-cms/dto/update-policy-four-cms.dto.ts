import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyFourCmsDto } from './base-policy-four-cms.dto';

export class UpdatePolicyFourCmsDto extends PartialType(BasePolicyFourCmsDto) {}
