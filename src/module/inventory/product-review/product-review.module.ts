import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductReviewService } from './product-review.service';
import { ProductReviewController } from './product-review.controller';
import { ProductReviewRepository } from './product-review.repository';
import { ProductReview } from './entities/product-review.entity';
import { ProductRepository } from '../product/product.repository';
import { UserRepository } from 'src/module/user/user.repository';
import { UserProfileRepository } from 'src/module/user-profile/user-profile.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductReview])
	],
	controllers: [ProductReviewController],
	providers: [ProductReviewService, ProductReviewRepository, ProductRepository, UserRepository, UserProfileRepository],
	exports: [ProductReviewService, ProductReviewRepository]
})

export class ProductReviewModule {}
