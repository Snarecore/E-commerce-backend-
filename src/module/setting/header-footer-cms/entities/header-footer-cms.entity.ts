import { AbstractEntity } from '../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('header-footer-cms')
export class HeaderFooterCms extends AbstractEntity {
	@Column({ type: 'text', nullable: true })
	bannerText: string;

	@Column({ type: 'varchar', nullable: true })
	helpline: string;

	@Column({ type: 'text', nullable: true })
	footerDescription: string;

	@Column({ type: 'varchar', nullable: true })
	copyrightText: string;

	@Column({ type: 'varchar', nullable: true })
	contactEmail: string;

	@Column({ type: 'varchar', nullable: true })
	contactPhone: string;

	@Column({ type: 'varchar', nullable: true })
	contactAddress: string;

	@Column({ type: 'varchar', nullable: true })
	headerLogo: string;

	@Column({ type: 'varchar', nullable: true })
	footerLogo: string;

	@Column({ type: 'varchar', nullable: true })
	footerSectionTwoTitle: string;

	@Column({ type: 'varchar', nullable: true })
	footerSectionThreeTitle: string;

	@Column({ type: 'json', nullable: true })
	footerSectionTwo: { value: string; link: string }[];

	@Column({ type: 'json', nullable: true })
	footerSectionThree: { value: string; link: string }[];

	@Column({ type: 'varchar', length: 50, nullable: true, default: '#218DAE' })
	primaryColor: string;

	@Column({ type: 'varchar', length: 50, nullable: true, default: '#1D7693' })
	secondaryColor: string;

	@Column({ type: 'json', nullable: true })
	themeConfig: any;
}
