import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyOneCmsDto } from './base-policy-one-cms.dto';

export class UpdatePolicyOneCmsDto extends PartialType(BasePolicyOneCmsDto) {}
