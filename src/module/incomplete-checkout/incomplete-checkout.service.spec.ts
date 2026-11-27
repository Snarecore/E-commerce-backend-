import { BadRequestException, HttpException } from '@nestjs/common';
import { IncompleteCheckoutService } from './incomplete-checkout.service';
import { CheckoutStatus } from './enums/checkout-status.enum';

describe('IncompleteCheckoutService.convertToOrder', () => {
    const baseCheckout = () => ({
        id: 'chk-1',
        publicCheckoutId: 'IC-1',
        status: CheckoutStatus.ABANDONED,
        customerId: null as string | null,
        customerPhone: '01711111111',
        customerName: 'Guest',
        shippingAddress: 'Road 1',
        shippingCity: 'Dhaka',
        cartItemsSnapshot: [{ productId: 'p1', title: 'Shirt', size: 'M', unitPriceMinor: 50000, quantity: 1, subtotalMinor: 50000 }],
    });

    let checkout: ReturnType<typeof baseCheckout>;
    let claimAffected: number;
    let checkoutRepo: any;
    let productRepo: any;
    let ordersService: { create: jest.Mock };
    let service: IncompleteCheckoutService;

    beforeEach(() => {
        checkout = baseCheckout();
        claimAffected = 1;
        const claimQb: any = { update: () => claimQb, set: () => claimQb, where: () => claimQb, execute: async () => ({ affected: claimAffected }) };
        checkoutRepo = {
            findOne: jest.fn(async () => checkout),
            createQueryBuilder: jest.fn(() => claimQb),
            update: jest.fn(),
            save: jest.fn(async (c: unknown) => c),
        };
        productRepo = { findOne: jest.fn(async () => ({ id: 'p1', isDeleted: false, quantity: 10, sizeStock: { M: 2 } })) };
        const activityRepo = { create: jest.fn((a: unknown) => a), save: jest.fn() };
        ordersService = { create: jest.fn(async () => ({ data: { id: 'ord-1', orderId: 'BB000001' } })) };
        service = new IncompleteCheckoutService(checkoutRepo, activityRepo as any, productRepo, {} as any, ordersService as any);
    });

    it('creates a guest order with the chosen size, a deterministic key and the admin as placer', async () => {
        await service.convertToOrder('chk-1', 'admin-1');

        const [dto, owner, options] = ordersService.create.mock.calls[0];
        expect(owner).toBeNull();
        expect(options).toEqual({ placedByAdminId: 'admin-1' });
        expect(dto.idempotencyKey).toBe('convert_chk-1');
        expect(dto.items[0]).toMatchObject({ productId: 'p1', size: 'M', quantity: 1 });
        expect(checkout.status).toBe(CheckoutStatus.CONVERTED);
    });

    it('rejects a second concurrent conversion of the same checkout', async () => {
        claimAffected = 0;
        await expect(service.convertToOrder('chk-1', 'admin-1')).rejects.toThrow(HttpException);
        expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('checks stock of the chosen size, not just the product total', async () => {
        checkout.cartItemsSnapshot[0].quantity = 3; // total 10, but only 2 in size M
        await expect(service.convertToOrder('chk-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('refuses a sized product when the checkout did not record a size', async () => {
        checkout.cartItemsSnapshot[0].size = undefined as unknown as string;
        await expect(service.convertToOrder('chk-1', 'admin-1')).rejects.toThrow(/sold by size/);
    });

    it('releases the claim when order creation fails so the admin can retry', async () => {
        ordersService.create.mockRejectedValue(new Error('stock changed'));
        await expect(service.convertToOrder('chk-1', 'admin-1')).rejects.toThrow('stock changed');
        expect(checkoutRepo.update).toHaveBeenCalledWith('chk-1', { convertedAt: null });
    });
});
