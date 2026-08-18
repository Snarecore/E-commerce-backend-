import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('subscription-tier')
export class SubscriptionTier extends AbstractEntity {
    @Column()
    name: string;

    @Column('float')
    commissionRate: number;

    @Column('int')
    durationInMonths: number;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;
}
