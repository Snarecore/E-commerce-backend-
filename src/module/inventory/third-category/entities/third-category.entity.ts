import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('third-category')
export class ThirdCategory extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar' })
	slug: string;

	@Column({ type: 'varchar' })
	bannerImage: string;

	@Column({ type: 'boolean', default: true })
    status: boolean;

	@Column({ type: 'varchar' })
	mainCategoryId: string;

	@Column({ type: 'varchar' })
	mainCategoryName: string;

	@Column({ type: 'varchar' })
	firstCategoryId: string;

	@Column({ type: 'varchar' })
	firstCategoryName: string;

	@Column({ type: 'varchar' })
	secondCategoryId: string;

	@Column({ type: 'varchar' })
	secondCategoryName: string;
}
