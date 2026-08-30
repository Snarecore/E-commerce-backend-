import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('hero-slider')
export class HeroSlider extends AbstractEntity {
	@Column({ type: 'varchar' })
	image: string;

	@Column({ type: 'varchar' })
	link: string;

	@Column({ type: 'boolean', default: true })
    status: boolean;
}
