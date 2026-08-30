import { AbstractEntity } from '../../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('contact-page-cms')
export class ContactPageCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	pageTitle: string;

	@Column({ type: 'varchar' })
	pageSubTitle: string;

	@Column({ type: 'varchar' })
	phone: string;

	@Column({ type: 'varchar' })
	email: string;

	@Column({ type: 'varchar' })
	address: string;

	@Column({ type: 'varchar' })
	formSectionTitleOne: string;

	@Column({ type: 'varchar' })
	formSectionTitleTwo: string;

	@Column({ type: 'varchar' })
	formSectionTitleThree: string;

	@Column({ type: 'varchar' })
	buttonText: string;
}
