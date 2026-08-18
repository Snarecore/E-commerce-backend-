import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyNineCmsDto } from './base-policy-nine-cms.dto';

export class UpdatePolicyNineCmsDto extends PartialType(BasePolicyNineCmsDto) {}
