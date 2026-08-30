import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('page-meta')
export class PageMeta extends AbstractEntity {
	@Column({ type: 'varchar' })
	page: string;

	@Column({ type: 'varchar', nullable: true })
	metaTitle: string;

	@Column({ type: 'text', nullable: true })
	metaDescription: string;

	@Column({ type: 'varchar', nullable: true })
	metaKeywords: string;
}
