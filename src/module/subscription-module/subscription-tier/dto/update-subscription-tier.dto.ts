import { PartialType } from '@nestjs/mapped-types';
import { CreateSubscriptionTierDto } from './create-subscription-tier.dto';

export class UpdateSubscriptionTierDto extends PartialType(CreateSubscriptionTierDto) {}
