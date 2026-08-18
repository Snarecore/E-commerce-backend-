import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyTwoCmsDto } from './base-policy-two-cms.dto';

export class UpdatePolicyTwoCmsDto extends PartialType(BasePolicyTwoCmsDto) {}
