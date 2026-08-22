import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from 'src/enums/order-status.enum';

export class UpdateOrderStatusDto {
    @IsNotEmpty()
    @IsEnum(OrderStatus)
    newStatus: OrderStatus;

    @IsOptional()
    @IsString()
    note?: string;
}
