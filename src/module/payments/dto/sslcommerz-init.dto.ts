import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SslcommerzInitDto {
    @IsNotEmpty()
    @IsString()
    orderId: string;

    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @IsOptional()
    @IsString()
    customerName?: string;

    @IsOptional()
    @IsString()
    customerPhone?: string;

    @IsOptional()
    @IsString()
    customerAddress?: string;

    @IsOptional()
    @IsString()
    customerCity?: string;

    @IsOptional()
    @IsString()
    frontendCallbackUrl?: string;
}
