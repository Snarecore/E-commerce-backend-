import { FilterDto } from "../../core/dto/filter.dto";
import { IsOptional } from 'class-validator';
import { OrderStatus, PaymentStatus } from "../../../enums/order-status.enum";

export class OrdersFilterDto extends FilterDto {
    @IsOptional()
    userId?: string;

    @IsOptional()
    vendorId?: string;

    @IsOptional()
    status?: OrderStatus;

    @IsOptional()
    paymentStatus?: PaymentStatus;
}
