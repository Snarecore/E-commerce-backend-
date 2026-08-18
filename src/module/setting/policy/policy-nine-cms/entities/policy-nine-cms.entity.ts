import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('policy-nine-cms')
export class PolicyNineCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'text' })
	description: string;
}
