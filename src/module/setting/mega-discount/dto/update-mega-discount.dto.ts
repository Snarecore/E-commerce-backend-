import { IsBoolean, IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class UpdateMegaDiscountDto {
	@IsBoolean()
	isActive: boolean;

	@IsNumber()
	@Min(0)
	@Max(100)
	discountPercentage: number;

	@IsString()
	@Length(1, 50)
	menuText: string;
}
