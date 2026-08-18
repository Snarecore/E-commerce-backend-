export interface HeaderFooterCmsInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	bannerText: string;
	helpline: string;
	footerDescription: string;
	copyrightText: string;
	contactEmail: string;
	contactPhone: string;
	contactAddress: string;
	headerLogo: string;
	footerLogo: string;
	footerSectionTwo: { value: string; link: string }[];
	footerSectionThree: { value: string; link: string }[];
}
