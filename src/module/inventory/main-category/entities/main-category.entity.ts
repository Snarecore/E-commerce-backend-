import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('main-category')
export class MainCategory extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar' })
	slug: string;

	@Column({ type: 'varchar' })
	image: string;

	@Column({ type: 'varchar' })
	bannerImage: string;

	@Column({ type: 'boolean', default: true })
    status: boolean;
}
