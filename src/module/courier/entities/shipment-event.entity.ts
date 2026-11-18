import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only history of everything the courier told us (or we did) for a shipment. */
@Entity('shipment_events')
@Index('IDX_shipment_events_shipment', ['shipmentId', 'createdAt'])
@Index('UQ_shipment_events_dedupe', ['dedupeKey'], { unique: true })
export class ShipmentEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;

    @Column({ type: 'varchar', length: 36 })
    shipmentId: string;

    @Column({ type: 'varchar', length: 16 })
    source: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    providerStatus: string | null;

    @Column({ type: 'varchar', length: 40, nullable: true })
    internalStatus: string | null;

    @Column({ type: 'text', nullable: true })
    message: string | null;

    /** Sanitized payload: no phone numbers or addresses. */
    @Column({ type: 'json', nullable: true })
    payload: Record<string, any> | null;

    @Column({ type: 'varchar', length: 64 })
    dedupeKey: string;

    @Column({ type: 'timestamp', nullable: true })
    providerEventAt: Date | null;
}
