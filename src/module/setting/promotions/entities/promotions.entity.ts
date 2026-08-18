import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('promotions')
export class Promotions extends AbstractEntity {
	@Column({ type: 'varchar' })
	image: string;

	@Column({ type: 'varchar' })
	link: string;

	@Column({ type: 'boolean', default: true })
    status: boolean;
}
