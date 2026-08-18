import { HttpException, HttpStatus, Injectable, Query } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { ProductReviewRepository } from './product-review.repository';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { ProductReviewInterface, ProductReviewResponse } from './type/product-review.type';
import { ProductReview } from './entities/product-review.entity';
import { ProductRepository } from '../product/product.repository';
import { UserRepository } from 'src/module/user/user.repository';
import { FindOptionsOrder, In } from 'typeorm';
import { ProductReviewFilterDto } from './dto/product-review-filter.dto';
import { ProductReviewFilter } from './type/product-review-filter.type';
import { UpdateProductReviewStatusDto } from './dto/update-product-review-status.dto';
import { Role } from 'src/enums/role.enum';
import { toSafeUser } from 'src/utils/safe-user.utils';
import { UserProfileRepository } from 'src/module/user-profile/user-profile.repository';

@Injectable()
export class ProductReviewService {
	constructor(
		private readonly repository: ProductReviewRepository,
		private readonly productRepository: ProductRepository,
		private readonly userRepository: UserRepository,
		private readonly userProfileRepository: UserProfileRepository
	) { }

	private async updateProductAverageRating(productId: string): Promise<void> {
		const reviews = await this.repository.findAll({ productId });

		if (!reviews.length) return;

		const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
		const averageRating = parseFloat((totalRating / reviews.length).toFixed(2));

		await this.productRepository.update(productId, { rating: averageRating });
	}

	async create(
		dto: CreateProductReviewDto,
		userData: any
	): Promise<ApiResponse<ProductReviewInterface>> {
		try {
			const userId = userData?.id;
			dto.userId = userId;

			const existingReview = await this.repository.findOneByQuery({
				userId: userId,
				productId: dto.productId
			});

			let output: ProductReview | null;

			if (existingReview) {
				output = await this.repository.update(existingReview.id, dto) as ProductReview | null;
			} else {
				output = await this.repository.create(dto) as ProductReview | null;
			}

			await this.updateProductAverageRating(dto.productId);

			if (!output) {
				throw new HttpException(
					'Something went wrong! Please try again.',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			const message = existingReview ? 'Review updated successfully.' : 'Review submitted successfully.';

			return ResponseUtils.successResponseHandler(200, message, 'data', output);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findAll(
		dto: ProductReviewFilterDto,
		userData: any
	): Promise<ApiResponse<{
		data: ProductReviewInterface[];
		total: number;
		page: number;
		limit: number;
		pageCount: number;
	}>> {
		try {
			const query: ProductReviewFilter = {};

			if (userData?.id) {
				query.vendorId = userData.id;
			}

			const order: FindOptionsOrder<ProductReview> = {
				createdAt: 'desc'
			};

			const result = await this.repository.paginate({
				page: dto.page || 1,
				limit: dto.limit || 10,
				query,
				order
			});

			const productIds = [...new Set(result.data.map(r => r.productId))];
			const userIds = [...new Set(result.data.map(r => r.userId))];

			const [products, users] = await Promise.all([
				this.productRepository.findAll({ id: In(productIds) }),
				this.userRepository.findAll({ id: In(userIds) })
			]);

			const productMap = new Map(products.map(p => [p.id, p]));
			const userMap = new Map(users.map(u => [u.id, u]));

			const enrichedReviews = result.data.map(review => ({
				...review,
				product: productMap.get(review.productId) || null,
				user: userMap.get(review.userId) || null
			}));

			const payload = {
				data: enrichedReviews,
				total: result.total,
				page: result.page,
				limit: result.limit,
				pageCount: result.pageCount
			};

			return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findAllforCustomer(
		dto: ProductReviewFilterDto,
		productId: string
	): Promise<ApiResponse<{
		data: ProductReviewInterface[];
		total: number;
		page: number;
		limit: number;
		pageCount: number;
	}>> {
		try {
			const query: ProductReviewFilter = {};

			if (productId) {
				query.productId = productId;
			}

			const order: FindOptionsOrder<ProductReview> = {
				createdAt: 'desc'
			};

			const result = await this.repository.paginate({
				page: dto.page || 1,
				limit: dto.limit || 10,
				query,
				order
			});

			const userIds = Array.from(new Set(result.data.map(r => r.userId).filter(Boolean)));
			let userMap = new Map<string, any>();
			let profileMap = new Map<string, string>();

			if (userIds.length > 0) {
				const [users, profiles] = await Promise.all([
					this.userRepository.findAll({ id: In(userIds) } as any),
					this.userProfileRepository.findAllWithRelations(
						{ user: { id: In(userIds) } } as any,
						['user']
					)
				]);

				userMap = new Map(users.map(u => [u.id, toSafeUser(u)]));
				profileMap = new Map(
					profiles
						.map(p => [p.user?.id, p.profileImage ?? null] as const)
						.filter(([uid]) => Boolean(uid))
				);
			}

			const enrichedReviews = result.data.map(review => {
				const safeUser = userMap.get(review.userId) ?? null;
				const profileImage = profileMap.get(review.userId) ?? null;

				return {
					...review,
					user: safeUser ? { ...safeUser, profileImage } : null,
				};
			});

			const payload = {
				data: enrichedReviews,
				total: result.total,
				page: result.page,
				limit: result.limit,
				pageCount: result.pageCount
			};

			return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findOne(id: string): Promise<ApiResponse<ProductReviewResponse>> {
		try {
			const data = await this.repository.findAll({ productId: id });
			if (!data || data.length === 0) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}

			let ratingSum = 0;
			const reviewCount = data.length;
			const ratingCounters = {
				1: 0,
				2: 0,
				3: 0,
				4: 0,
				5: 0
			};

			for (const review of data) {
				const rating = review.rating;
				ratingSum += rating;
				if (ratingCounters.hasOwnProperty(rating)) {
					ratingCounters[rating]++;
				}
			}

			const ratingAverage = reviewCount > 0 ? Math.round(ratingSum / reviewCount) : 0;

			const response = {
				data,
				reviewCount,
				ratingAverage,
				countOneStartRating: ratingCounters[1],
				countTwoStartRating: ratingCounters[2],
				countThreeStartRating: ratingCounters[3],
				countFourStartRating: ratingCounters[4],
				countFiveStartRating: ratingCounters[5]
			};

			return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', response);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async remove(id: string): Promise<ApiResponse<boolean>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
			const response = await this.repository.softDelete(id);
			const result = response !== null;
			return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	// async updateApprovalStatus(
	// 	dto: UpdateProductReviewStatusDto,
	// 	userData: any
	// ): Promise<ApiResponse<ProductReviewInterface>> {
	// 	try {
	// 		const review = await this.repository.findOne(dto.reviewId);
	// 		if (!review) {
	// 			throw new HttpException('Review not found.', HttpStatus.NOT_FOUND);
	// 		}

	// 		const product = await this.productRepository.findOne(review.productId);
	// 		if (!product) {
	// 			throw new HttpException('Product not found.', HttpStatus.NOT_FOUND);
	// 		}

	// 		const isVendorOwner = userData?.role === Role.VENDOR && product.vendorId === userData.id;

	// 		if (!isVendorOwner) {
	// 			throw new HttpException('Not authorized to approve this review.', HttpStatus.FORBIDDEN);
	// 		}

	// 		const updatedReview = await this.repository.update(review.id, {
	// 			isApprove: dto.isApprove
	// 		}) as ProductReview;

	// 		await this.updateProductAverageRating(review.productId);

	// 		const message = dto.isApprove ? 'Review approved successfully' : 'Review disapproved successfully';
	// 		return ResponseUtils.successResponseHandler(200, message, 'data', updatedReview);
	// 	} catch (error: unknown) {
	// 		const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
	// 		throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
	// 	}
	// }
}
