import { PartialType } from '@nestjs/mapped-types';
import { BasePolicyTenCmsDto } from './base-policy-ten-cms.dto';

export class UpdatePolicyTenCmsDto extends PartialType(BasePolicyTenCmsDto) {}
