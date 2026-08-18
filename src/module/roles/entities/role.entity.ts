import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('roles')
export class Roles extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;
}
