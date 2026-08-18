import { AbstractEntity } from 'src/database/abstract.entity';
import { User } from 'src/module/user/entities/user.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity('vendor-payment-requests')
export class VendorPaymentRequest extends AbstractEntity {
    @Column()
    vendorId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'vendorId' })
    vendor: User;

    @Column('decimal', { precision: 12, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'PAID'], default: 'PENDING' })
    status: 'PENDING' | 'APPROVED' | 'PAID';

    @Column({ type: 'timestamp', nullable: true })
    approvedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date;

    @Column({ nullable: true })
    invoiceUrl: string;

    @Column({ nullable: true })
    paymentRef: string;

    @Column({ nullable: true })
    gateway: string;

    @Column({ nullable: true })
    notes: string;
}
