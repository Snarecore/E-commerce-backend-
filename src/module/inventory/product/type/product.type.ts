export interface ProductInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
    slug: string;
	sku: string;
	featuredImage: string;
	description: string;
    videoUrl: string;
	fileUrl: string;
	summary: string;
	price: number;
	cost: number;
	discountType: string;
	discountAmount: number;
	mainCategoryId: string;
	mainCategoryName: string;
	firstCategoryId: string;
	firstCategoryName: string;
	secondCategoryId: string;
	secondCategoryName: string;
	thirdCategoryId: string;
	thirdCategoryName: string;
	vendorId: string;
	vendorName: string;
	status: boolean;
	isApprove: boolean;
	isProductSectionOne: boolean;
	isProductSectionTwo: boolean;
	isProductSectionThree: boolean;
	isProductSectionFour: boolean;
	isProductSectionFive: boolean;
	isProductSectionSix: boolean;
	productImages?: ProductImageInterface[];
}

export interface ProductImageInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	productId: string;
	imageUrl: string;
}