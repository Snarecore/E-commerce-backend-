export interface ProductReviewInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	productId: string;
	vendorId: string;
	rating: number;
	userId: string;
}

export interface ProductReviewResponse {
	data: ProductReviewInterface[];
	reviewCount: number;
	ratingAverage: number;
	countOneStartRating: number;
	countTwoStartRating: number;
	countThreeStartRating: number;
	countFourStartRating: number;
	countFiveStartRating: number;
}