import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { CONFIG } from '../../utils/config';
import { Public } from '../../decorators/public.decorator';
import { ShipmentService } from './services/shipment.service';
import { CourierProvider, ShipmentEventSource } from './enums/shipment-status.enum';

/**
 * Steadfast pushes status changes here. Authenticated with a shared Bearer token that
 * we choose and register in the Steadfast merchant panel (STEADFAST_WEBHOOK_TOKEN).
 * Always answers 200 for authenticated requests so Steadfast doesn't retry-storm on
 * events we intentionally ignore (unknown consignment, duplicates).
 */
@Controller({ path: 'courier/webhooks', version: CONFIG.API_VERSION })
export class SteadfastWebhookController {
    private readonly logger = new Logger(SteadfastWebhookController.name);

    constructor(
        private readonly shipmentService: ShipmentService,
        private readonly config: ConfigService
    ) {}

    @Public()
    @Post('steadfast')
    @HttpCode(200)
    async handle(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
        this.verifyToken(authorization);

        const payload = body && typeof body === 'object' ? body : {};
        const consignmentId = payload.consignment_id != null ? String(payload.consignment_id) : null;
        const invoice = payload.invoice != null ? String(payload.invoice) : null;
        const providerStatus = payload.status ?? payload.delivery_status ?? null;
        const notificationType = String(payload.notification_type || (providerStatus ? 'delivery_status' : 'tracking_update'));
        const updatedAt = payload.updated_at ? new Date(payload.updated_at) : null;
        const providerEventAt = updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null;
        const message = payload.tracking_message ? String(payload.tracking_message).slice(0, 1000) : null;

        const shipment = await this.shipmentService.findByProviderReference(CourierProvider.STEADFAST, consignmentId, invoice);
        if (!shipment) {
            this.logger.warn(`[Steadfast Webhook] No shipment for consignment=${consignmentId} invoice=${invoice}`);
            return { status: 'success', message: 'Webhook received (no matching shipment).' };
        }

        const dedupeKey = this.shipmentService.hash(
            ['STEADFAST', consignmentId, invoice, notificationType, providerStatus, payload.updated_at, message].join('|')
        );

        const outcome = await this.shipmentService.applyProviderStatus(shipment.id, {
            providerStatus: providerStatus ? String(providerStatus) : null,
            source: ShipmentEventSource.WEBHOOK,
            dedupeKey,
            providerEventAt,
            message: message || (providerStatus ? `Status: ${providerStatus}` : null),
            codCollected: this.toNumber(payload.cod_amount),
            courierCharge: this.toNumber(payload.delivery_charge),
            payload: this.sanitize(payload)
        });

        return { status: 'success', message: `Webhook received (${outcome}).` };
    }

    private verifyToken(authorization: string | undefined): void {
        const expected = (this.config.get<string>('STEADFAST_WEBHOOK_TOKEN') || '').trim();
        if (!expected) {
            throw new HttpException('Webhook is not configured.', HttpStatus.SERVICE_UNAVAILABLE);
        }
        const provided = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
        const a = createHash('sha256').update(provided).digest();
        const b = createHash('sha256').update(expected).digest();
        if (!provided || !timingSafeEqual(a, b)) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
    }

    private toNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    /** Keep only operational fields; never store recipient phone/address from the courier. */
    private sanitize(payload: Record<string, any>): Record<string, any> {
        const allowed = ['notification_type', 'consignment_id', 'invoice', 'status', 'delivery_status', 'cod_amount', 'delivery_charge', 'tracking_message', 'updated_at'];
        const out: Record<string, any> = {};
        for (const key of allowed) if (payload[key] !== undefined) out[key] = payload[key];
        return out;
    }
}
