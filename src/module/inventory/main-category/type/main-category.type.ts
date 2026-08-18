export interface MainCategoryInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
    slug: string;
	image: string;
	bannerImage: string;
    status: boolean;
}