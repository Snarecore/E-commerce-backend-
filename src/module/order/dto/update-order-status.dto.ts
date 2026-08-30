import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../enums/order-status.enum';

export class UpdateOrderStatusDto {
    @IsNotEmpty()
    @IsEnum(OrderStatus)
    newStatus: OrderStatus;

    @IsOptional()
    @IsString()
    rejectionReason?: string;

    @IsOptional()
    @IsString()
    rejectionMessage?: string;

    @IsOptional()
    @IsString()
    note?: string;
}
