import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyFiveCmsDto } from './base-policy-five-cms.dto';

export class UpdatePolicyFiveCmsDto extends PartialType(BasePolicyFiveCmsDto) {}
