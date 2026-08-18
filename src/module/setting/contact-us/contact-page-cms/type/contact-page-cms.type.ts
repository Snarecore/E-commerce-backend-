export interface ContactPageCmsInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	pageTitle: string;
	pageSubTitle: string;
	phone: string;
	email: string;
	address: string;
	formSectionTitleOne: string;
	formSectionTitleTwo: string;
	formSectionTitleThree: string;
	buttonText: string;
}