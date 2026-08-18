export interface ProductImageGalleryInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	productId: string;
	imageUrl: string;
}