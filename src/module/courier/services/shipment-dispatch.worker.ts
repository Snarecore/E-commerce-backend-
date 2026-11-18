import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShipmentService } from './shipment.service';
import { SteadfastClient } from '../providers/steadfast/steadfast.client';

const DISPATCH_BATCH = 20;
/** Upper bound per run so one tick can't hog the process; the next tick continues. */
const MAX_BATCHES_PER_RUN = 5;
const POLL_BATCH = 50;
/** Webhooks are the primary signal; polling is the safety net for missed ones. */
const POLL_STALE_MS = 60 * 60 * 1000;

@Injectable()
export class ShipmentDispatchWorker {
    private readonly logger = new Logger(ShipmentDispatchWorker.name);
    private dispatching = false;
    private polling = false;

    constructor(
        private readonly shipmentService: ShipmentService,
        private readonly steadfast: SteadfastClient
    ) {}

    /** Retries PENDING_DISPATCH bookings (transient failures, crashed attempts). */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async processDispatchQueue(): Promise<void> {
        if (this.dispatching || !this.steadfast.isEnabled()) return;
        this.dispatching = true;
        try {
            for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
                const due = await this.shipmentService.findDueForDispatch(DISPATCH_BATCH);
                for (const shipment of due) {
                    try {
                        await this.shipmentService.dispatchNow(shipment.id);
                    } catch (error: any) {
                        this.logger.error(`[Dispatch] Shipment ${shipment.id} failed: ${error?.message}`);
                    }
                }
                if (due.length < DISPATCH_BATCH) break;
            }
        } catch (error: any) {
            this.logger.error(`[Dispatch] Queue scan failed: ${error?.message}`);
        } finally {
            this.dispatching = false;
        }
    }

    /** Pulls status for live shipments not updated within the last hour. */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async pollActiveShipments(): Promise<void> {
        if (this.polling || !this.steadfast.isEnabled()) return;
        this.polling = true;
        try {
            const ids = await this.shipmentService.claimDueForPolling(POLL_BATCH, new Date(Date.now() - POLL_STALE_MS));
            for (const id of ids) {
                try {
                    await this.shipmentService.syncFromProvider(id);
                } catch (error: any) {
                    this.logger.warn(`[Poll] Shipment ${id} sync failed: ${error?.message}`);
                }
                // Be gentle with the courier API.
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
        } catch (error: any) {
            this.logger.error(`[Poll] Scan failed: ${error?.message}`);
        } finally {
            this.polling = false;
        }
    }
}
