export interface FirstCategoryInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
    slug: string;
	bannerImage: string;
    status: boolean;
	position?: number;
	mainCategoryId: string;
	mainCategoryName: string;
}