export interface BlogInterface {
	id: string;
	title: string;
	slug: string;
	description: string;
	image: string;
	imageAltText: string;
	author: string;
	status: boolean;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
}
