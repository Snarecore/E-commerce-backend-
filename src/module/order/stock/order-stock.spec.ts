import { findOrderLines, releaseOrderStock, reserveOrderStock } from './order-stock';

const managerWith = (products: Record<string, any>) => ({
    findOne: jest.fn(async (_entity: unknown, { where }: any) => products[where.id] ?? null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('reserveOrderStock', () => {
    it('deducts total and per-size stock for every line', async () => {
        const manager = managerWith({ p1: { id: 'p1', quantity: 5, sizeStock: { M: 3 } } });
        await expect(reserveOrderStock(manager as any, [{ productId: 'p1', quantity: 2, size: 'M' } as any])).resolves.toBe(true);
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'p1', { quantity: 3, sizeStock: { M: 1 } });
    });

    it('keeps untracked (null) stock untracked', async () => {
        const manager = managerWith({ p1: { id: 'p1', quantity: null, sizeStock: null } });
        await reserveOrderStock(manager as any, [{ productId: 'p1', quantity: 2 } as any]);
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'p1', { quantity: null, sizeStock: null });
    });

    it('changes nothing when any line is short', async () => {
        const manager = managerWith({
            a: { id: 'a', quantity: 10, sizeStock: null },
            b: { id: 'b', quantity: 10, sizeStock: { L: 0 } },
        });
        const ok = await reserveOrderStock(manager as any, [
            { productId: 'a', quantity: 1 } as any,
            { productId: 'b', quantity: 1, selectedSize: 'L' } as any,
        ]);
        expect(ok).toBe(false);
        expect(manager.update).not.toHaveBeenCalled();
    });

    it('locks products in ascending id order to avoid deadlocks', async () => {
        const manager = managerWith({ a: { id: 'a', quantity: 9 }, z: { id: 'z', quantity: 9 } });
        await reserveOrderStock(manager as any, [{ productId: 'z', quantity: 1 } as any, { productId: 'a', quantity: 1 } as any]);
        expect(manager.findOne.mock.calls.map(([, opts]: any) => opts.where.id)).toEqual(['a', 'z']);
    });
});

describe('releaseOrderStock', () => {
    it('adds quantities back per size and reports ledger changes', async () => {
        const manager = managerWith({ p1: { id: 'p1', quantity: 3, sizeStock: { M: 1 } } });
        const changes = await releaseOrderStock(manager as any, [{ productId: 'p1', quantity: 2, selectedSize: 'M' } as any]);
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'p1', { quantity: 5, sizeStock: { M: 3 } });
        expect(changes).toEqual([expect.objectContaining({ size: 'M', quantity: 2, onHandBefore: 1, onHandAfter: 3 })]);
    });

    it('keeps untracked stock untracked instead of turning it into a fixed number', async () => {
        const manager = managerWith({ p1: { id: 'p1', quantity: null, sizeStock: null } });
        await releaseOrderStock(manager as any, [{ productId: 'p1', quantity: 4 } as any]);
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'p1', { quantity: null, sizeStock: null });
    });

    it('skips products that no longer exist', async () => {
        const manager = managerWith({});
        await expect(releaseOrderStock(manager as any, [{ productId: 'gone', quantity: 1 } as any])).resolves.toEqual([]);
    });
});

describe('findOrderLines', () => {
    it('looks lines up by the order UUID (the FK), never by the human order number', async () => {
        const manager: any = { find: jest.fn().mockResolvedValue([]) };
        await findOrderLines(manager, { id: 'uuid-1', orderId: 'BB123456' } as any);
        expect(manager.find).toHaveBeenCalledWith(expect.anything(), { where: { orderId: 'uuid-1' } });
    });
});
