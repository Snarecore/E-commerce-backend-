export enum PaymentGateway {
    SSLCOMMERZ = 'SSLCOMMERZ',
    STRIPE = 'STRIPE',
    COD = 'COD'
}

export enum PaymentMethodType {
    BKASH = 'BKASH',
    NAGAD = 'NAGAD',
    ROCKET = 'ROCKET',
    UPAY = 'UPAY',
    VISA = 'VISA',
    MASTERCARD = 'MASTERCARD',
    BANK = 'BANK',
    COD = 'COD',
    UNKNOWN = 'UNKNOWN'
}

export enum PaymentAttemptStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    PAID = 'PAID',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED',
    UNKNOWN = 'UNKNOWN'
}

export enum PaymentEventSource {
    BROWSER_CALLBACK = 'BROWSER_CALLBACK',
    IPN = 'IPN',
    RECONCILIATION_WORKER = 'RECONCILIATION_WORKER',
    ADMIN = 'ADMIN'
}

export enum RefundStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    UNKNOWN = 'UNKNOWN'
}

export enum InboxStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    PROCESSED = 'PROCESSED',
    FAILED = 'FAILED',
    DEAD_LETTER = 'DEAD_LETTER'
}

export enum OutboxStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    PUBLISHED = 'PUBLISHED',
    FAILED = 'FAILED'
}
