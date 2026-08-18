import { AbstractEntity } from 'src/database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('contact-us-message')
export class ContactUsMessage extends AbstractEntity {
	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar' })
	email: string;

	@Column({ type: 'varchar' })
	phone: string;

	@Column({ type: 'longtext' })
  	message: string;
}
