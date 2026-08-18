import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyThreeCmsDto } from './base-policy-three-cms.dto';

export class UpdatePolicyThreeCmsDto extends PartialType(BasePolicyThreeCmsDto) {}
