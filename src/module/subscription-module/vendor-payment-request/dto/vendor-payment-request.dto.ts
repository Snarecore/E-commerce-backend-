import { Transform } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class CreatePaymentRequestDto {
    @IsNumber()
    @Min(1)
    @Transform(({ value }) => parseFloat(value))
    amount: number;
}
