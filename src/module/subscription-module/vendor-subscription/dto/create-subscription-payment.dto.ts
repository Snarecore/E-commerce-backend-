import { IsNotEmpty } from 'class-validator';

export class CreateSubscriptionPaymentDto {
    @IsNotEmpty()
    tierId: string;

    @IsNotEmpty()
    currency: string;
}
