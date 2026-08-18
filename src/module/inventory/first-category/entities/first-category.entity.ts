import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('first-category')
export class FirstCategory extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar' })
	slug: string;

	@Column({ type: 'varchar' })
	bannerImage: string;

	@Column({ type: 'varchar', default: '' })
	image: string;

	@Column({ type: 'boolean', default: true })
    status: boolean;

	@Column({ type: 'boolean', default: false })
	showOnHome: boolean;

	@Column({ type: 'varchar' })
	mainCategoryId: string;

	@Column({ type: 'varchar' })
	mainCategoryName: string;
}
