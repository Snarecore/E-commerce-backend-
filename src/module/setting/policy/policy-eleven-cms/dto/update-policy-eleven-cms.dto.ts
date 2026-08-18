import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyElevenCmsDto } from './base-policy-eleven-cms.dto';

export class UpdatePolicyElevenCmsDto extends PartialType(BasePolicyElevenCmsDto) {}
