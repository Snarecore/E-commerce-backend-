import { releaseCouponUsage, reclaimCouponUsage } from './coupon-usage.ledger';

const queryBuilder = () => {
    const qb: any = { update: jest.fn(() => qb), set: jest.fn(() => qb), where: jest.fn(() => qb), execute: jest.fn().mockResolvedValue({}) };
    return qb;
};

describe('coupon usage ledger', () => {
    it('frees every usage row of a cancelled order and lowers usageCount per coupon', async () => {
        const qb = queryBuilder();
        const manager: any = {
            find: jest.fn().mockResolvedValue([
                { id: 'u1', couponId: 'c1' },
                { id: 'u2', couponId: 'c1' },
            ]),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
        };
        await expect(releaseCouponUsage(manager, 'BB100001')).resolves.toBe(2);
        expect(manager.delete).toHaveBeenCalledWith(expect.anything(), ['u1', 'u2']);
        expect(qb.where).toHaveBeenCalledWith('id = :couponId', { couponId: 'c1' });
        expect(qb.set.mock.calls[0][0].usageCount()).toBe('GREATEST(usageCount - 2, 0)');
    });

    it('does nothing for an order without coupon usage', async () => {
        const manager: any = { find: jest.fn().mockResolvedValue([]), delete: jest.fn() };
        await expect(releaseCouponUsage(manager, 'BB1')).resolves.toBe(0);
        expect(manager.delete).not.toHaveBeenCalled();
    });

    it('re-records usage once when a cancelled order is revived', async () => {
        const manager: any = {
            findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'u1' }),
            create: jest.fn((_e, data) => data),
            save: jest.fn(),
            increment: jest.fn(),
        };
        const order = { orderId: 'BB1', couponId: 'c1', userId: 'user', discountAmount: '50.00' };
        await reclaimCouponUsage(manager, order);
        await reclaimCouponUsage(manager, order);
        expect(manager.save).toHaveBeenCalledTimes(1);
        expect(manager.increment).toHaveBeenCalledTimes(1);
    });
});
