import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SubscriptionTier } from '../../subscription-tier/entities/subscription-tier.entity';
import { User } from 'src/module/user/entities/user.entity';

@Entity('vendor-subscriptions')
export class VendorSubscription extends AbstractEntity {
    @Column()
    vendorId: string;

    @Column()
    tierId: string;

    @ManyToOne(() => SubscriptionTier)
    @JoinColumn({ name: 'tierId' })
    tier: SubscriptionTier;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'vendorId' })
    vendor: User;

    @Column({ type: 'timestamp' })
    startDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    endDate: Date;
}
