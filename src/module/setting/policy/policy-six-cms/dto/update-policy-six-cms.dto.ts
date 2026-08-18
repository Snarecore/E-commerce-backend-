import { PartialType } from '@nestjs/mapped-types';
import { BasePolicySixCmsDto } from './base-policy-six-cms.dto';

export class UpdatePolicySixCmsDto extends PartialType(BasePolicySixCmsDto) {}
