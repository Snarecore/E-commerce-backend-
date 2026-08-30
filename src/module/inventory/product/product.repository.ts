import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductRepository extends AbstractRepository<Product> {
	constructor(dataSource: DataSource) {
		super(dataSource, Product);
	}

	createQueryBuilder(alias: string) {
		return this.repository.createQueryBuilder(alias);
	}

	async getVendorCategoryAndProductStatistics(vendorId: string) {
		const baseCondition = {
			vendorId,
			status: true,
			isApprove: true,
			isDeleted: false
		};

		const totalProducts = await this.repository.count({
			where: baseCondition
		});

		const queryBuilder = this.repository.createQueryBuilder('product');
		const { count } = await queryBuilder
			.select('COUNT(DISTINCT product.mainCategoryId)', 'count')
			.where('product.vendorId = :vendorId', { vendorId })
			.andWhere('product.status = true')
			.andWhere('product.isApprove = true')
			.andWhere('product.isDeleted = false')
			.getRawOne();

		return {
			totalProducts,
			totalCategories: Number(count ?? 0)
		};
	}
}
