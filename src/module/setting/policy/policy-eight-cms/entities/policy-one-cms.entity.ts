import { AbstractEntity } from '../../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('policy-eight-cms')
export class PolicyEightCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'text' })
	description: string;
}
