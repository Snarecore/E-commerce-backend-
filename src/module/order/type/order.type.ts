import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';

export interface OrdersInterface {
    id: string;
    orderId: string;
    userId: string;
    paymentIntentId: string;
    totalAmount: number;
    currency: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
}
