import { Column, Entity } from 'typeorm';
import { AbstractEntity } from 'src/database/abstract.entity';

@Entity('blog')
export class Blog extends AbstractEntity {
	@Column({ type: 'varchar' })
	title: string;

	@Column({ type: 'varchar' })
	slug: string;

	@Column({ type: 'text' })
	description: string;

	@Column({ type: 'varchar' })
	author: string;

	@Column({ type: 'varchar', nullable: true })
	image: string;

	@Column({ type: 'varchar', nullable: true })
	imageAltText: string;

	@Column({ type: 'boolean', default: true })
	status: boolean;
}
