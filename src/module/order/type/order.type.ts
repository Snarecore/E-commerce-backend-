import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';

export interface OrdersInterface {
    id: string;
    orderId: string;
    userId: string;
    paymentIntentId?: string | null;
    paymentMethod?: string;
    totalAmount: number;
    subtotal?: number;
    deliveryCharge?: number;
    currency: string;
    shippingAddress?: any;
    specialNote?: string;
    courierName?: string;
    trackingId?: string;
    courierTrackingLink?: string;
    idempotencyKey?: string;
    statusHistory?: Array<{
        status: string;
        timestamp: string;
        updatedBy: string;
        updatedByUserId?: string;
        note?: string;
    }>;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
}
