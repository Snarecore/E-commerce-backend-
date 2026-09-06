import { OrderStatus, PaymentStatus } from "../../../enums/order-status.enum";
import { FindOperator } from "typeorm";

export interface OrdersFilter {
    userId?: string;
    vendorId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    orderId?: string | FindOperator<string>;
    createdAt?: FindOperator<Date>;
}