import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { decidePaidOrderAction, getPaymentStartBlocker, PaidOrderAction, PaidOrderReviewReason, wasCancelledBySystem } from './paid-order.policy';

const order = (status: OrderStatus, paymentStatus = PaymentStatus.PENDING, cancelledBy?: string) =>
    ({
        status,
        paymentStatus,
        statusHistory: cancelledBy ? [{ status: OrderStatus.CANCELLED, timestamp: '', updatedBy: cancelledBy }] : [],
    }) as any;

describe('decidePaidOrderAction', () => {
    it('confirms orders that are awaiting payment or still in the warehouse', () => {
        for (const status of [OrderStatus.PENDING, OrderStatus.ORDER_PLACED, OrderStatus.PROCESSING, OrderStatus.PREPARING_ORDER]) {
            expect(decidePaidOrderAction(order(status)).action).toBe(PaidOrderAction.CONFIRM);
        }
    });

    it('revives only orders the expiry worker cancelled', () => {
        expect(decidePaidOrderAction(order(OrderStatus.CANCELLED, PaymentStatus.UNPAID, 'system')).action).toBe(PaidOrderAction.REVIVE);
        expect(decidePaidOrderAction(order(OrderStatus.CANCELLED, PaymentStatus.UNPAID, 'admin'))).toEqual({
            action: PaidOrderAction.REVIEW_AND_REFUND,
            reason: PaidOrderReviewReason.ORDER_CANCELLED_BY_ADMIN,
        });
    });

    it('never moves a dispatched order backwards', () => {
        for (const status of [OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED]) {
            expect(decidePaidOrderAction(order(status, PaymentStatus.UNPAID)).reason).toBe(PaidOrderReviewReason.PAID_AFTER_DISPATCH);
        }
    });

    it('flags a second capture on an already paid order', () => {
        expect(decidePaidOrderAction(order(OrderStatus.ORDER_PLACED, PaymentStatus.PAID)).reason).toBe(PaidOrderReviewReason.DUPLICATE_PAYMENT);
    });

    it('refuses closed orders', () => {
        for (const status of [OrderStatus.REJECTED, OrderStatus.RETURNED, OrderStatus.COMPLETED]) {
            expect(decidePaidOrderAction(order(status)).reason).toBe(PaidOrderReviewReason.ORDER_CLOSED);
        }
    });

    it('reads the latest cancellation entry', () => {
        const revivedThenCancelledByAdmin = {
            status: OrderStatus.CANCELLED,
            statusHistory: [
                { status: OrderStatus.CANCELLED, updatedBy: 'system' },
                { status: OrderStatus.PENDING, updatedBy: 'customer' },
                { status: OrderStatus.CANCELLED, updatedBy: 'admin' },
            ],
        } as any;
        expect(wasCancelledBySystem(revivedThenCancelledByAdmin)).toBe(false);
    });
});

describe('getPaymentStartBlocker', () => {
    const withTotal = (o: any, totalAmount = '500.00') => ({ ...o, totalAmount });

    it('allows a pending order and blocks paid, under-review and zero-total orders', () => {
        expect(getPaymentStartBlocker(withTotal(order(OrderStatus.PENDING)))).toBeNull();
        expect(getPaymentStartBlocker(withTotal(order(OrderStatus.PENDING, PaymentStatus.PAID)))).toMatch(/already paid/);
        expect(getPaymentStartBlocker(withTotal(order(OrderStatus.PENDING, PaymentStatus.REVIEW_REQUIRED)))).toMatch(/under review/);
        expect(getPaymentStartBlocker(withTotal(order(OrderStatus.PENDING), '0.00'))).toMatch(/nothing to pay/);
    });

    it('lets retry revive an expired order but never one an admin cancelled', () => {
        const expired = withTotal(order(OrderStatus.CANCELLED, PaymentStatus.UNPAID, 'system'));
        const adminCancelled = withTotal(order(OrderStatus.CANCELLED, PaymentStatus.UNPAID, 'admin'));
        expect(getPaymentStartBlocker(expired)).not.toBeNull();
        expect(getPaymentStartBlocker(expired, { allowExpiredRevival: true })).toBeNull();
        expect(getPaymentStartBlocker(adminCancelled, { allowExpiredRevival: true })).toMatch(/cancelled/);
    });

    it('blocks payments once the parcel is dispatched', () => {
        expect(getPaymentStartBlocker(withTotal(order(OrderStatus.SHIPPED, PaymentStatus.UNPAID)))).toMatch(/Shipped/);
    });
});
