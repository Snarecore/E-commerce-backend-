import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { ShipmentStatus } from '../enums/shipment-status.enum';

/**
 * One courier booking for an order. The row doubles as its own outbox:
 * PENDING_DISPATCH rows are claimed by ShipmentDispatchWorker with a lease.
 */
@Entity('shipments')
@Index('IDX_shipments_dispatch_queue', ['status', 'nextAttemptAt', 'leaseExpiresAt'])
@Index('IDX_shipments_order', ['orderId'])
@Index('IDX_shipments_consignment', ['provider', 'consignmentId'])
@Index('IDX_shipments_attention', ['needsAttention', 'updatedAt'])
@Index('UQ_shipments_provider_invoice', ['provider', 'invoice'], { unique: true })
// Non-null only while the shipment is live; guarantees at most one live shipment per order.
@Index('UQ_shipments_active_order', ['activeOrderKey'], { unique: true })
export class Shipment extends AbstractEntity {
    /** orders.id (uuid) */
    @Column({ type: 'varchar', length: 36 })
    orderId: string;

    /** orders.orderId (human-readable code) */
    @Column({ type: 'varchar', length: 64 })
    orderCode: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    activeOrderKey: string | null;

    @Column({ type: 'varchar', length: 32 })
    provider: string;

    /** Our idempotency reference sent to the courier. Unique per provider. */
    @Column({ type: 'varchar', length: 64 })
    invoice: string;

    @Column({ type: 'varchar', length: 40, default: ShipmentStatus.PENDING_DISPATCH })
    status: ShipmentStatus;

    @Column({ type: 'varchar', length: 64, nullable: true })
    providerStatus: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    consignmentId: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    trackingCode: string | null;

    @Column({ type: 'varchar', length: 512, nullable: true })
    trackingUrl: string | null;

    /** Amount the courier must collect, frozen at dispatch time. 0 for prepaid orders. */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    codAmount: number;

    /** Amount the courier reports as collected (may differ on partial delivery). */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    codCollectedAmount: number | null;

    /** What the courier charges us (not what the customer paid for delivery). */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    courierCharge: number | null;

    @Column({ type: 'timestamp', nullable: true })
    codSettledAt: Date | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    codSettlementRef: string | null;

    @Column({ type: 'varchar', length: 120 })
    recipientName: string;

    @Column({ type: 'varchar', length: 20 })
    recipientPhone: string;

    @Column({ type: 'text' })
    recipientAddress: string;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    // Dispatch queue bookkeeping
    @Column({ type: 'int', default: 0 })
    attemptCount: number;

    @Column({ type: 'timestamp', nullable: true })
    nextAttemptAt: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    leaseToken: string | null;

    @Column({ type: 'timestamp', nullable: true })
    leaseExpiresAt: Date | null;

    @Column({ type: 'text', nullable: true })
    lastError: string | null;

    /** Set when a human must look (duplicate invoice, partial delivery, failed order transition...). */
    @Column({ type: 'boolean', default: false })
    needsAttention: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastProviderStatusAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    lastSyncedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    dispatchedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt: Date | null;

    @Column({ type: 'varchar', length: 36, nullable: true })
    requestedByUserId: string | null;
}
