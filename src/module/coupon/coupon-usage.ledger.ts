import { EntityManager } from 'typeorm';
import { Coupon } from './entity/coupon.entity';
import { CouponUsage } from './entity/coupon-usage.entity';

/**
 * Coupon usage bookkeeping tied to an order's lifecycle. Redemption happens at checkout
 * (CouponService.redeemCouponInTransaction); these functions keep `usageCount` and the
 * per-customer usage rows true when that order is later cancelled or revived. They run inside
 * the caller's transaction, next to the matching stock change.
 *
 * `orderId` is the human order number (e.g. BB123456), as stored on CouponUsage.
 */

/** Frees the coupon usage of an order that will not be fulfilled (cancel, reject, expiry). */
export async function releaseCouponUsage(manager: EntityManager, orderId: string): Promise<number> {
    const usages = await manager.find(CouponUsage, { where: { orderId } });
    if (usages.length === 0) return 0;

    const perCoupon = new Map<string, number>();
    for (const usage of usages) perCoupon.set(usage.couponId, (perCoupon.get(usage.couponId) ?? 0) + 1);

    await manager.delete(CouponUsage, usages.map((usage) => usage.id));
    for (const [couponId, count] of perCoupon) {
        await manager
            .createQueryBuilder()
            .update(Coupon)
            .set({ usageCount: () => `GREATEST(usageCount - ${Number(count)}, 0)` })
            .where('id = :couponId', { couponId })
            .execute();
    }
    return usages.length;
}

/**
 * Re-records the usage when a cancelled order is revived by a late payment or a retry. The
 * customer already received the discount at checkout, so this restores the bookkeeping
 * without re-checking limits. No-op when the order used no coupon or still holds its usage.
 */
export async function reclaimCouponUsage(
    manager: EntityManager,
    order: { orderId: string; couponId?: string | null; userId?: string | null; discountAmount?: number | string | null; phone?: string | null }
): Promise<void> {
    if (!order.couponId) return;
    const existing = await manager.findOne(CouponUsage, { where: { couponId: order.couponId, orderId: order.orderId } });
    if (existing) return;

    await manager.save(
        manager.create(CouponUsage, {
            couponId: order.couponId,
            orderId: order.orderId,
            userId: order.userId || null,
            phone: order.phone || null,
            discountAmount: Number(order.discountAmount) || 0,
        })
    );
    await manager.increment(Coupon, { id: order.couponId }, 'usageCount', 1);
}

/** The order fields reclaimCouponUsage needs, taken from an order entity. */
export function couponUsageOwner(order: {
    orderId: string;
    couponId?: string | null;
    userId?: string | null;
    discountAmount?: number | string | null;
    shippingAddress?: { phone?: string | null } | null;
}): Parameters<typeof reclaimCouponUsage>[1] {
    return {
        orderId: order.orderId,
        couponId: order.couponId,
        userId: order.userId,
        discountAmount: order.discountAmount,
        phone: order.shippingAddress?.phone ?? null,
    };
}
