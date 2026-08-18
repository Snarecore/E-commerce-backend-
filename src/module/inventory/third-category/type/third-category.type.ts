export interface ThirdCategoryInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
    slug: string;
	bannerImage: string;
    status: boolean;
	mainCategoryId: string;
	mainCategoryName: string;
	firstCategoryId: string;
	firstCategoryName: string;
	secondCategoryId: string;
	secondCategoryName: string;
}