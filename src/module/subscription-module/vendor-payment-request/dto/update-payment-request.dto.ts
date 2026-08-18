import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentRequestStatusDto {
    @IsEnum(['APPROVED', 'PAID'])
    status: 'APPROVED' | 'PAID';

    @IsOptional()
    paymentRef?: string;

    @IsOptional()
    gateway?: string;
}
