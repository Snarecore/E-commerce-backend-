import { IsNotEmpty } from 'class-validator';

export class BaseCommissionRateCmsDto {
	@IsNotEmpty()
	commissionRate: number;
}
