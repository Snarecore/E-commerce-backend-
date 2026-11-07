import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { Payments } from './payment.entity';
import { PaymentEventSource } from '../enums/payment.enum';

@Entity('payment_events')
@Index('IDX_payment_events_paymentId', ['paymentId'])
@Index('UQ_payment_event_fingerprint', ['paymentId', 'eventFingerprint'], { unique: true })
export class PaymentEvents extends AbstractEntity {
    @Column({ type: 'uuid', nullable: false })
    paymentId: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    eventType: string;

    @Column({
        type: 'enum',
        enum: PaymentEventSource,
        nullable: false
    })
    source: PaymentEventSource;

    @Column({ type: 'varchar', length: 255, nullable: true })
    providerEventId: string | null;

    @Column({ type: 'varchar', length: 64, nullable: false })
    eventFingerprint: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    gatewayStatus: string;

    @Column({ type: 'json', nullable: true })
    sanitizedPayload: Record<string, any> | null;

    @ManyToOne(() => Payments, (payment) => payment.events, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'paymentId' })
    payment: Payments;
}
