import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('social-link')
export class SocialLink extends AbstractEntity {
	@Column({ type: 'varchar' })
	icon: string;

	@Column({ type: 'varchar' })
	link: string;
}
