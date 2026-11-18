// OrdersService pulls in firebase-admin (ESM); the courier tests only need its interface.
jest.mock('../order/order.service', () => ({ OrdersService: class {} }));

import { HttpException } from '@nestjs/common';
import { mapSteadfastStatus } from './providers/steadfast/steadfast-status.mapper';
import { ShipmentEventSource, ShipmentStatus } from './enums/shipment-status.enum';
import { ShipmentService } from './services/shipment.service';
import { SteadfastClient } from './providers/steadfast/steadfast.client';
import { SteadfastWebhookController } from './steadfast-webhook.controller';
import { CourierError } from './providers/courier-provider.interface';
import { OrderStatus, PaymentStatus } from '../../enums/order-status.enum';

describe('Steadfast status mapping', () => {
    it.each([
        ['in_review', ShipmentStatus.IN_REVIEW],
        ['pending', ShipmentStatus.IN_TRANSIT],
        ['hold', ShipmentStatus.ON_HOLD],
        ['delivered_approval_pending', ShipmentStatus.APPROVAL_PENDING],
        ['cancelled_approval_pending', ShipmentStatus.APPROVAL_PENDING],
        ['delivered', ShipmentStatus.DELIVERED],
        ['partial_delivered', ShipmentStatus.PARTIAL_DELIVERED],
        ['DELIVERED', ShipmentStatus.DELIVERED]
    ])('maps %s -> %s', (raw, expected) => {
        expect(mapSteadfastStatus(raw)).toBe(expected);
    });

    it('treats courier "cancelled" as a return in transit, never as an order cancellation', () => {
        expect(mapSteadfastStatus('cancelled')).toBe(ShipmentStatus.RETURN_IN_TRANSIT);
    });

    it('maps unrecognised values to UNKNOWN instead of guessing', () => {
        expect(mapSteadfastStatus('teleported')).toBe(ShipmentStatus.UNKNOWN);
        expect(mapSteadfastStatus(null)).toBe(ShipmentStatus.UNKNOWN);
    });
});

describe('ShipmentService pure rules', () => {
    const service = new ShipmentService({} as any, {} as any, {} as any, {} as any);

    it('sends COD 0 for prepaid orders', () => {
        expect(service.computeCodAmount({ paymentStatus: PaymentStatus.PAID, totalAmount: 1520 } as any)).toBe(0);
    });

    it('sends the whole-taka order total for unpaid COD orders', () => {
        expect(service.computeCodAmount({ paymentStatus: PaymentStatus.PENDING, totalAmount: 1520.4 } as any)).toBe(1520);
    });

    it('rejects a negative total', () => {
        expect(() => service.computeCodAmount({ paymentStatus: PaymentStatus.PENDING, totalAmount: -1 } as any)).toThrow(HttpException);
    });

    it('uses the order code as invoice and suffixes re-bookings', () => {
        expect(service.buildInvoice('ORD-1001', 0)).toBe('ORD-1001');
        expect(service.buildInvoice('ORD-1001', 2)).toBe('ORD-1001-R2');
        expect(service.buildInvoice('#ORD 1001', 0)).toBe('ORD1001');
    });
});

describe('ShipmentService.applyProviderStatus', () => {
    const makeService = (shipment: any) => {
        const manager = {
            findOne: jest.fn().mockResolvedValue(shipment),
            insert: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined)
        };
        const queryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            isTransactionActive: true,
            manager
        };
        const shipmentsRepo = { findOne: jest.fn().mockResolvedValue(shipment), update: jest.fn() };
        const dataSource = {
            createQueryRunner: () => queryRunner,
            getRepository: () => shipmentsRepo,
            manager
        };
        const steadfast = { mapStatus: mapSteadfastStatus };
        const ordersService = { updateOrderStatus: jest.fn().mockResolvedValue({}) };
        const service = new ShipmentService(dataSource as any, steadfast as any, ordersService as any, {} as any);
        return { service, manager, ordersService, shipmentsRepo };
    };

    const baseShipment = () => ({
        id: 's1',
        orderId: 'o1',
        provider: 'STEADFAST',
        consignmentId: '123',
        status: ShipmentStatus.IN_TRANSIT,
        codAmount: 1500,
        lastProviderStatusAt: new Date('2026-11-10T10:00:00Z'),
        deliveredAt: null,
        codCollectedAmount: null
    });

    const update = (providerStatus: string, at = '2026-11-11T10:00:00Z') => ({
        providerStatus,
        source: ShipmentEventSource.WEBHOOK,
        dedupeKey: `k-${providerStatus}-${at}`,
        providerEventAt: new Date(at)
    });

    it('delivers the order without marking COD paid', async () => {
        const { service, manager, ordersService } = makeService(baseShipment());
        await expect(service.applyProviderStatus('s1', update('delivered'))).resolves.toBe('applied');
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 's1' }, expect.objectContaining({
            status: ShipmentStatus.DELIVERED,
            codCollectedAmount: 1500
        }));
        expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(
            'o1',
            expect.objectContaining({ newStatus: OrderStatus.DELIVERED }),
            expect.anything(),
            { codSettlementPending: true }
        );
    });

    it('moves the order to RETURNED (no restock) when the courier cancels', async () => {
        const { service, ordersService } = makeService(baseShipment());
        await service.applyProviderStatus('s1', update('cancelled'));
        expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(
            'o1',
            expect.objectContaining({ newStatus: OrderStatus.RETURNED }),
            expect.anything(),
            expect.anything()
        );
    });

    it('flags partial delivery for a human and leaves the order alone', async () => {
        const { service, manager, ordersService } = makeService(baseShipment());
        await service.applyProviderStatus('s1', update('partial_delivered'));
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 's1' }, expect.objectContaining({
            status: ShipmentStatus.PARTIAL_DELIVERED,
            needsAttention: true
        }));
        expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('ignores duplicate events', async () => {
        const { service, manager, ordersService } = makeService(baseShipment());
        manager.insert.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
        await expect(service.applyProviderStatus('s1', update('delivered'))).resolves.toBe('duplicate');
        expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('does not let an older event overwrite a newer status', async () => {
        const { service, manager, ordersService } = makeService(baseShipment());
        await service.applyProviderStatus('s1', update('delivered', '2026-11-01T00:00:00Z'));
        expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 's1' }, expect.not.objectContaining({ status: expect.anything() }));
        expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('never regresses a delivered shipment', async () => {
        const { service, ordersService } = makeService({ ...baseShipment(), status: ShipmentStatus.DELIVERED });
        await expect(service.applyProviderStatus('s1', update('pending'))).resolves.toBe('ignored');
        expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('flags the shipment when the order transition is rejected', async () => {
        const { service, ordersService, shipmentsRepo } = makeService(baseShipment());
        ordersService.updateOrderStatus.mockRejectedValueOnce(new Error('Invalid status transition'));
        await service.applyProviderStatus('s1', update('delivered'));
        expect(shipmentsRepo.update).toHaveBeenCalledWith({ id: 's1' }, expect.objectContaining({ needsAttention: true }));
    });
});

describe('SteadfastClient error classification', () => {
    const config = { get: (key: string) => ({ STEADFAST_ENABLED: 'true', STEADFAST_API_KEY: 'k', STEADFAST_SECRET_KEY: 's' } as any)[key] };
    const client = new SteadfastClient(config as any);
    const classify = (data: any, status?: number) => (client as any).classifyBodyError(data, status) as CourierError;
    const classifyHttp = (err: any) => (client as any).classifyHttpError(err, '/create_order') as CourierError;

    it('detects duplicate invoice', () => {
        expect(classify({ status: 400, errors: { invoice: ['The invoice has already been taken.'] } }).kind).toBe('DUPLICATE');
    });

    it('treats other validation errors as rejected', () => {
        expect(classify({ status: 400, message: 'recipient_phone must be 11 digits' }).kind).toBe('REJECTED');
    });

    it('treats network failures, 429 and 5xx as transient', () => {
        expect(classifyHttp({ message: 'timeout', code: 'ECONNABORTED' }).kind).toBe('TRANSIENT');
        expect(classifyHttp({ message: 'x', response: { status: 429, data: {} } }).kind).toBe('TRANSIENT');
        expect(classifyHttp({ message: 'x', response: { status: 502, data: {} } }).kind).toBe('TRANSIENT');
    });

    it('treats 401 as a config problem', () => {
        expect(classifyHttp({ message: 'x', response: { status: 401, data: {} } }).kind).toBe('CONFIG');
    });

    it('builds the public tracking URL', () => {
        expect(client.buildTrackingUrl('ABC123')).toBe('https://steadfast.com.bd/t/ABC123');
        expect(client.buildTrackingUrl(null)).toBeNull();
    });
});

describe('SteadfastWebhookController auth', () => {
    const token = 'x'.repeat(40);
    const shipmentService = {
        findByProviderReference: jest.fn().mockResolvedValue(null),
        hash: (s: string) => s,
        applyProviderStatus: jest.fn()
    };
    const make = (configured: string | undefined) =>
        new SteadfastWebhookController(shipmentService as any, { get: () => configured } as any);

    it('rejects a wrong token', async () => {
        await expect(make(token).handle('Bearer wrong', {})).rejects.toThrow('Unauthorized');
    });

    it('rejects everything when no token is configured', async () => {
        await expect(make(undefined).handle(`Bearer ${token}`, {})).rejects.toThrow(HttpException);
    });

    it('accepts the right token and answers 200 for unknown consignments', async () => {
        await expect(make(token).handle(`Bearer ${token}`, { consignment_id: 9, status: 'delivered' }))
            .resolves.toEqual(expect.objectContaining({ status: 'success' }));
    });
});

describe('ShipmentService bulk operations', () => {
    it('queues valid orders and reports per-order failures without aborting the batch', async () => {
        const service = new ShipmentService({} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service, 'requestDispatch')
            .mockResolvedValueOnce({ id: 'ship-1' } as any)
            .mockRejectedValueOnce(new HttpException('Recipient phone is not a valid Bangladeshi mobile number.', 400))
            .mockResolvedValueOnce({ id: 'ship-3' } as any);

        const results = await service.requestDispatchBulk(['o1', 'o2', 'o3', 'o1'], {} as any);

        expect(results).toEqual([
            { orderId: 'o1', ok: true, shipmentId: 'ship-1', message: 'Queued for booking' },
            { orderId: 'o2', ok: false, message: 'Recipient phone is not a valid Bangladeshi mobile number.' },
            { orderId: 'o3', ok: true, shipmentId: 'ship-3', message: 'Queued for booking' }
        ]);
    });

    it('settles COD for many shipments and reports the ones that cannot be settled', async () => {
        const service = new ShipmentService({} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service, 'markCodSettled')
            .mockResolvedValueOnce({} as any)
            .mockRejectedValueOnce(new HttpException('COD is already marked as settled.', 400));
        const results = await service.markCodSettledBulk(['s1', 's2'], {} as any, 'SFC-1');
        expect(results.map((r) => r.ok)).toEqual([true, false]);
        expect(service.markCodSettled).toHaveBeenCalledWith('s1', {}, 'SFC-1');
    });
});
