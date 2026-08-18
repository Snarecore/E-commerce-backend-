import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('commission-rate-cms')
export class CommissionRateCms extends AbstractEntity {
	@Column('float')
    commissionRate: number;
}
