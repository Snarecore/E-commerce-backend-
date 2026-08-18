import { IsNotEmpty, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateSubscriptionTierDto {
    @IsNotEmpty()
    name: string;

    @IsNumber()
    commissionRate: number;

    @IsNumber()
    durationInMonths: number;

    @IsNumber()
    price: number;
}
