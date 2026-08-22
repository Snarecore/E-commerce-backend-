export enum OrderStatus {
    ORDER_PLACED = 'Order Placed',
    PROCESSING = 'Processing',
    PREPARING_ORDER = 'Preparing Order',
    SHIPPED = 'Shipped',
    LOADED_FOR_DELIVERY = 'Loaded for Delivery',
    HANDED_OVER_TO_COURIER = 'Handed Over to Courier',
    OUT_FOR_DELIVERY = 'Out for Delivery',
    DELIVERED = 'Delivered',
    CANCELLED = 'Cancelled',
    RETURNED = 'Returned',
    PENDING = 'Pending',
    COMPLETED = 'Completed',
    FAILED = 'Failed'
}

export enum PaymentStatus {
    PENDING = 'Pending',
    PAID = 'Paid',
    UNPAID = 'Unpaid',
    FAILED = 'Failed'
}