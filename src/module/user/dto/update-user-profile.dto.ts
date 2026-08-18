import { IsOptional, IsString } from 'class-validator';

export class UpdateUserProfileDto {
	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	phone?: string;

	@IsOptional()
	@IsString()
	shopName?: string;

	@IsOptional()
	@IsString()
	profileImage?: string;

	@IsOptional()
	@IsString()
	shopImage?: string;

	@IsOptional()
	@IsString()
	accountNumber?: string;

	@IsOptional()
	@IsString()
	accountHolderName?: string;

	@IsOptional()
	@IsString()
	bankName?: string;

	@IsOptional()
	@IsString()
	branchName?: string;

	@IsOptional()
	@IsString()
	IBAN?: string;

	@IsOptional()
	@IsString()
	country?: string;

	@IsOptional()
	@IsString()
	swiftCode?: string;

	@IsOptional()
	@IsString()
	paypalEmailAddress?: string;
}
