import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyTwelveCmsDto } from './base-policy-twelve-cms.dto';

export class UpdatePolicyTwelveCmsDto extends PartialType(BasePolicyTwelveCmsDto) {}
