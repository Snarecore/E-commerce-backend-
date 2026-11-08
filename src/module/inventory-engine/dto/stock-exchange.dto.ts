import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class ExecuteExchangeDto {
    @IsNotEmpty()
    @IsString()
    orderId: string;

    @IsNotEmpty()
    @IsString()
    productId: string;

    @IsOptional()
    @IsString()
    orderSummaryId?: string;

    @IsNotEmpty()
    @IsString()
    oldSize: string;

    @IsNotEmpty()
    @IsString()
    newSize: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    quantity: number;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    note?: string;
}
