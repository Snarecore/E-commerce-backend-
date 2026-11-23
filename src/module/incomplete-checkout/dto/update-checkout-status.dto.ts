import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CheckoutStatus } from '../enums/checkout-status.enum';

export class UpdateCheckoutStatusDto {
    @IsNotEmpty()
    @IsEnum(CheckoutStatus)
    status: CheckoutStatus;

    @IsOptional()
    @IsString()
    note?: string;
}
