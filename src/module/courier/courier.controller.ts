import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CONFIG } from '../../utils/config';
import { ResponseUtils } from '../../utils/response.utils';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { ShipmentService } from './services/shipment.service';
import { SteadfastClient } from './providers/steadfast/steadfast.client';
import { ShipmentDispatchWorker } from './services/shipment-dispatch.worker';
import {
    BulkCreateShipmentsDto,
    BulkSettleCodDto,
    ReadyOrdersFilterDto,
    CancelShipmentDto,
    CreateShipmentDto,
    LinkConsignmentDto,
    ResolveAttentionDto,
    SettleCodDto,
    ShipmentListFilterDto
} from './dto/shipment-actions.dto';

/** Admin-only courier operations. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller({ path: 'courier', version: CONFIG.API_VERSION })
export class CourierController {
    constructor(
        private readonly shipmentService: ShipmentService,
        private readonly steadfast: SteadfastClient,
        private readonly dispatchWorker: ShipmentDispatchWorker
    ) {}

    @Get('status')
    getIntegrationStatus() {
        return ResponseUtils.successResponseHandler(200, 'Courier integration status.', 'data', {
            steadfastEnabled: this.steadfast.isEnabled()
        });
    }

    @Get('shipments')
    async list(@Query() filter: ShipmentListFilterDto) {
        const result = await this.shipmentService.listShipments(filter);
        return ResponseUtils.successResponseHandler(200, 'Shipments fetched.', 'data', result);
    }

    @Get('ready-orders')
    async readyOrders(@Query() filter: ReadyOrdersFilterDto) {
        const result = await this.shipmentService.listReadyToBook(filter);
        return ResponseUtils.successResponseHandler(200, 'Orders ready to book.', 'data', result);
    }

    /** Queues up to 50 orders; the worker books them in the background. */
    @Post('shipments/bulk')
    async bulkCreate(@Body() dto: BulkCreateShipmentsDto, @Req() req: Request) {
        const results = await this.shipmentService.requestDispatchBulk(dto.orderIds, req.user as any);
        // Start booking now instead of waiting for the next cron tick; errors are handled inside.
        void this.dispatchWorker.processDispatchQueue();
        const queued = results.filter((r) => r.ok).length;
        return ResponseUtils.successResponseHandler(
            200,
            `${queued} of ${results.length} order(s) queued for Steadfast booking.`,
            'data',
            results
        );
    }

    @Post('shipments/bulk-cod-settled')
    async bulkSettle(@Body() dto: BulkSettleCodDto, @Req() req: Request) {
        const results = await this.shipmentService.markCodSettledBulk(dto.shipmentIds, req.user as any, dto.reference);
        const settled = results.filter((r) => r.ok).length;
        return ResponseUtils.successResponseHandler(200, `${settled} of ${results.length} shipment(s) marked COD received.`, 'data', results);
    }

    @Get('orders/:orderId/shipments')
    async listForOrder(@Param('orderId', new ParseUUIDPipe()) orderId: string) {
        const shipments = await this.shipmentService.listForOrder(orderId);
        return ResponseUtils.successResponseHandler(200, 'Shipments fetched.', 'data', shipments);
    }

    /** Books the order with Steadfast. Persists first, then makes one immediate attempt; the worker retries. */
    @Post('orders/:orderId/shipments')
    async create(
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Body() dto: CreateShipmentDto,
        @Req() req: Request
    ) {
        const created = await this.shipmentService.requestDispatch(orderId, req.user as any, dto.note);
        const shipment = await this.shipmentService.dispatchNow(created.id);
        return ResponseUtils.successResponseHandler(201, this.dispatchMessage(shipment?.status), 'data', shipment);
    }

    @Post('shipments/:id/retry')
    async retry(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
        const shipment = await this.shipmentService.retryDispatch(id, req.user as any);
        return ResponseUtils.successResponseHandler(200, this.dispatchMessage(shipment?.status), 'data', shipment);
    }

    @Post('shipments/:id/sync')
    async sync(@Param('id', new ParseUUIDPipe()) id: string) {
        const shipment = await this.shipmentService.syncFromProvider(id);
        return ResponseUtils.successResponseHandler(200, 'Shipment status synced from courier.', 'data', shipment);
    }

    @Post('shipments/:id/cancel')
    async cancel(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CancelShipmentDto, @Req() req: Request) {
        const shipment = await this.shipmentService.cancelDispatch(id, req.user as any, dto.reason);
        return ResponseUtils.successResponseHandler(200, 'Courier booking cancelled.', 'data', shipment);
    }

    @Post('shipments/:id/link')
    async link(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: LinkConsignmentDto, @Req() req: Request) {
        const shipment = await this.shipmentService.linkConsignment(id, dto.consignmentId, dto.trackingCode, req.user as any);
        return ResponseUtils.successResponseHandler(200, 'Consignment linked.', 'data', shipment);
    }

    @Post('shipments/:id/resolve')
    async resolve(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ResolveAttentionDto, @Req() req: Request) {
        const shipment = await this.shipmentService.resolveAttention(id, req.user as any, dto.note);
        return ResponseUtils.successResponseHandler(200, 'Marked as resolved.', 'data', shipment);
    }

    @Post('shipments/:id/cod-settled')
    async settleCod(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SettleCodDto, @Req() req: Request) {
        const shipment = await this.shipmentService.markCodSettled(id, req.user as any, dto.reference);
        return ResponseUtils.successResponseHandler(200, 'COD settlement recorded; order marked paid.', 'data', shipment);
    }

    private dispatchMessage(status?: string): string {
        if (!status) return 'Booking queued.';
        if (status === 'PENDING_DISPATCH') return 'Courier is not responding; booking queued and will retry automatically.';
        if (status === 'DISPATCH_FAILED') return 'Courier booking failed. See the error on the shipment.';
        if (status === 'CANCELLED') return 'Booking was not sent: order is no longer dispatchable.';
        return 'Parcel booked with Steadfast.';
    }
}
