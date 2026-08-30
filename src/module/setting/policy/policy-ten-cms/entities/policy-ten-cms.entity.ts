import { AbstractEntity } from '../../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('policy-ten-cms')
export class PolicyTenCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'text' })
	description: string;
}
