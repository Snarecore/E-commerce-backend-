import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('policy-two-cms')
export class PolicyTwoCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'text' })
	description: string;
}
