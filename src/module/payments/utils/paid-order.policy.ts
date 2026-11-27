import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { Orders } from '../../order/entity/order.entity';

/**
 * What to do with an order when a gateway reports a successful, verified payment for it.
 *
 * This is the single rulebook for every gateway (SSLCommerz, Stripe, reconciliation). A
 * payment never moves an order backwards and never silently overrides an admin decision:
 * anything that cannot be applied cleanly is kept as a paid attempt, flagged for review,
 * and gets a pending refund record.
 */
export enum PaidOrderAction {
    /** Order is awaiting payment or still being prepared: mark it paid (PENDING → ORDER_PLACED). */
    CONFIRM = 'CONFIRM',
    /** Order was auto-cancelled when its payment window expired: re-reserve stock, then confirm. */
    REVIVE = 'REVIVE',
    /** Payment cannot be applied: keep the order as it is, flag for review, queue a refund. */
    REVIEW_AND_REFUND = 'REVIEW_AND_REFUND',
}

export enum PaidOrderReviewReason {
    DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
    ORDER_CANCELLED_BY_ADMIN = 'ORDER_CANCELLED_BY_ADMIN',
    PAID_AFTER_DISPATCH = 'PAID_AFTER_DISPATCH',
    ORDER_CLOSED = 'ORDER_CLOSED',
    LATE_PAYMENT_STOCK_EXHAUSTED = 'LATE_PAYMENT_STOCK_EXHAUSTED',
}

export interface PaidOrderDecision {
    action: PaidOrderAction;
    reason?: PaidOrderReviewReason;
}

type PolicyOrder = Pick<Orders, 'status' | 'paymentStatus' | 'statusHistory'>;

/** Statuses where stock is still held and nothing has left the warehouse. */
const CONFIRMABLE = new Set<string>([OrderStatus.PENDING, OrderStatus.ORDER_PLACED, OrderStatus.PROCESSING, OrderStatus.PREPARING_ORDER]);

/** The parcel is with (or past) the courier, who may collect cash on delivery. */
const DISPATCHED = new Set<string>([
    OrderStatus.SHIPPED,
    OrderStatus.LOADED_FOR_DELIVERY,
    OrderStatus.HANDED_OVER_TO_COURIER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
]);

/** The `updatedBy` value the order-expiry worker writes when it auto-cancels an order. */
export const SYSTEM_ACTOR = 'system';

/** True when the order's latest cancellation was the automatic payment-window expiry. */
export function wasCancelledBySystem(order: Pick<Orders, 'status' | 'statusHistory'>): boolean {
    if (order.status !== OrderStatus.CANCELLED) return false;
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const lastCancel = [...history].reverse().find((entry) => entry?.status === OrderStatus.CANCELLED);
    return lastCancel?.updatedBy === SYSTEM_ACTOR;
}

export function decidePaidOrderAction(order: PolicyOrder): PaidOrderDecision {
    if (order.paymentStatus === PaymentStatus.PAID) {
        return { action: PaidOrderAction.REVIEW_AND_REFUND, reason: PaidOrderReviewReason.DUPLICATE_PAYMENT };
    }
    if (CONFIRMABLE.has(order.status)) {
        return { action: PaidOrderAction.CONFIRM };
    }
    if (order.status === OrderStatus.CANCELLED) {
        return wasCancelledBySystem(order)
            ? { action: PaidOrderAction.REVIVE }
            : { action: PaidOrderAction.REVIEW_AND_REFUND, reason: PaidOrderReviewReason.ORDER_CANCELLED_BY_ADMIN };
    }
    if (DISPATCHED.has(order.status)) {
        return { action: PaidOrderAction.REVIEW_AND_REFUND, reason: PaidOrderReviewReason.PAID_AFTER_DISPATCH };
    }
    // REJECTED, RETURNED, COMPLETED, FAILED and anything unknown
    return { action: PaidOrderAction.REVIEW_AND_REFUND, reason: PaidOrderReviewReason.ORDER_CLOSED };
}

/**
 * Whether a customer may start a new online payment for this order. Mirrors the confirmation
 * rules above, so a payment is only ever started for an order that it could cleanly confirm.
 * `allowExpiredRevival` lets the retry flow restart orders the expiry worker cancelled (it
 * re-reserves stock first); an admin's cancellation is final.
 */
export function getPaymentStartBlocker(
    order: Pick<Orders, 'status' | 'paymentStatus' | 'statusHistory' | 'totalAmount'>,
    options: { allowExpiredRevival?: boolean } = {}
): string | null {
    if (order.paymentStatus === PaymentStatus.PAID) return 'This order is already paid.';
    if (order.paymentStatus === PaymentStatus.REVIEW_REQUIRED) return 'A payment for this order is under review. Please contact support.';
    if (!(Number(order.totalAmount) > 0)) return 'This order has nothing to pay online.';
    if (CONFIRMABLE.has(order.status)) return null;
    if (order.status === OrderStatus.CANCELLED) {
        return options.allowExpiredRevival && wasCancelledBySystem(order) ? null : 'This order was cancelled and cannot accept new payments.';
    }
    return `Cannot start a payment for an order with status "${order.status}".`;
}
