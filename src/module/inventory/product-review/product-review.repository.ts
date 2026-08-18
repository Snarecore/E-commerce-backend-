import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { ProductReview } from './entities/product-review.entity';

@Injectable()
export class ProductReviewRepository extends AbstractRepository<ProductReview> {
	constructor(dataSource: DataSource) {
		super(dataSource, ProductReview);
	}
}
