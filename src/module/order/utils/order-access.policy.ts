import { Role } from '../../../enums/role.enum';
import { GuestTokenUtil } from './guest-token.util';

/** Header carrying the signed guest order token returned by POST /orders. */
export const GUEST_ORDER_TOKEN_HEADER = 'x-guest-order-token';

export type OrderViewer = { id?: string; role?: string } | null | undefined;

/** Why a caller may see an order. `null` means no access. */
export type OrderAccess = 'admin' | 'owner' | 'guest' | null;

/**
 * Single source of truth for who may read an order:
 * - admins: any order
 * - a signed-in customer: only orders they own
 * - anyone holding the signed guest token issued at checkout for that order
 */
export const resolveOrderAccess = (
	order: { userId?: string | null; orderId: string },
	viewer: OrderViewer,
	guestToken?: string | null,
): OrderAccess => {
	if (viewer?.role === Role.ADMIN) return 'admin';
	if (viewer?.id && order.userId && order.userId === viewer.id) return 'owner';
	if (guestToken && GuestTokenUtil.verify(guestToken, order.orderId)) return 'guest';
	return null;
};

const CUSTOMER_ORDER_FIELDS = [
	'id', 'orderId', 'status', 'paymentStatus', 'paymentMethod', 'currency',
	'totalAmount', 'subtotal', 'deliveryCharge', 'discountAmount', 'couponCode',
	'megaDiscountApplied', 'megaDiscountPercentage', 'shippingAddress', 'specialNote',
	'courierName', 'trackingId', 'courierTrackingLink', 'rejectionReason', 'rejectionMessage',
	'isExchanged', 'exchangeCount', 'exchangedAt', 'orderPaymentExpiresAt', 'isPhoneVerified',
	'createdAt', 'updatedAt',
] as const;

const CUSTOMER_ITEM_FIELDS = [
	'id', 'productId', 'productName', 'productImage', 'size', 'selectedSize', 'originalSize',
	'price', 'quantity', 'subtotal', 'isExchanged', 'exchangeCount',
] as const;

const pick = (source: Record<string, any>, fields: readonly string[]) =>
	Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]]));

/**
 * Customer-facing projection of an order. An allow-list, so new internal columns
 * (costs, profit, risk scores, IPs, admin notes) stay hidden by default.
 */
export const toCustomerOrderView = (order: Record<string, any>) => ({
	...pick(order, CUSTOMER_ORDER_FIELDS),
	orderSummaries: (order.orderSummaries || []).map((item: Record<string, any>) => pick(item, CUSTOMER_ITEM_FIELDS)),
	statusHistory: (order.statusHistory || []).map((entry: Record<string, any>) => pick(entry, ['status', 'timestamp', 'note'])),
});
