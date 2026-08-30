import { AbstractEntity } from '../../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('policy-four-cms')
export class PolicyFourCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'text' })
	description: string;
}
