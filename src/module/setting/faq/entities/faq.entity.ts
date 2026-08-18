import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('faq')
export class Faq extends AbstractEntity {
	@Column({ type: 'varchar' })
	question: string;

	@Column({ type: 'longtext' })
  	answer: string;
}
