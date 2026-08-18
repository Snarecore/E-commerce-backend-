import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyEightCmsDto } from './base-policy-eight-cms.dto';

export class UpdatePolicyEightCmsDto extends PartialType(BasePolicyEightCmsDto) {}
