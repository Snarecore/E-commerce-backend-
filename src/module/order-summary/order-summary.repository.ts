import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { OrderSummary } from './entity/order-summary.entity';

@Injectable()
export class OrderSummaryRepository extends AbstractRepository<OrderSummary> {
	constructor(dataSource: DataSource) {
		super(dataSource, OrderSummary);
	}

	async getTotalCommissionForVendor(vendorId: string): Promise<number> {
		const { total = 0 } = await this.repository
			.createQueryBuilder('summary')
			.select('SUM(summary.commissionAmount)', 'total')
			.where('summary.vendorId = :vendorId', { vendorId })
			.getRawOne();

		return Number(total);
	}

	async getTotalEarningsForVendor(vendorId: string): Promise<number> {
		const { total = 0 } = await this.repository
			.createQueryBuilder('summary')
			.select('SUM(summary.price * summary.quantity)', 'total')
			.where('summary.vendorId = :vendorId', { vendorId })
			.getRawOne();

		return Number(total);
	}

	async getVendorSalesStatistics(vendorId: string) {
		const result = await this.repository
			.createQueryBuilder('summary')
			.select('COUNT(DISTINCT summary.orderId)', 'totalOrders')
			.addSelect('SUM(summary.price * summary.quantity)', 'totalSalesAmount')
			.addSelect('SUM(summary.commissionAmount)', 'totalCommissionPaid')
			.where('summary.vendorId = :vendorId', { vendorId })
			.getRawOne();

		return {
			totalOrders: Number(result.totalOrders ?? 0),
			totalSalesAmount: Number(result.totalSalesAmount ?? 0),
			totalCommissionPaid: Number(result.totalCommissionPaid ?? 0)
		};
	}

	async getTopCategoriesByVendor(vendorId: string) {
		return await this.repository
			.createQueryBuilder('summary')
			.select('product.mainCategoryName', 'category')
			.addSelect('COUNT(*)', 'sales')
			.innerJoin('product', 'product', 'product.id = summary.productId')
			.where('summary.vendorId = :vendorId', { vendorId })
			.andWhere('product.status = true')
			.andWhere('product.isApprove = true')
			.andWhere('product.isDeleted = false')
			.groupBy('product.mainCategoryName')
			.orderBy('sales', 'DESC')
			.limit(5)
			.getRawMany();
	}

	async getTopSellingProductsByVendor(vendorId: string) {
		return await this.repository
			.createQueryBuilder('summary')
			.select('product.id', 'productId')
			.addSelect('product.name', 'productName')
			.addSelect('product.featuredImage', 'productImage')
			.addSelect('product.price', 'price')
			.addSelect('SUM(summary.quantity)', 'sales')
			.innerJoin('product', 'product', 'product.id = summary.productId')
			.where('summary.vendorId = :vendorId', { vendorId })
			.andWhere('product.status = true')
			.andWhere('product.isApprove = true')
			.andWhere('product.isDeleted = false')
			.groupBy('product.id')
			.orderBy('sales', 'DESC')
			.limit(5)
			.getRawMany();
	}

	async getVendorMonthlySalesAndCommission(vendorId: string) {
		const startMonth = new Date();
		startMonth.setMonth(startMonth.getMonth() - 11);
		startMonth.setDate(1);
		startMonth.setHours(0, 0, 0, 0);

		return await this.repository
			.createQueryBuilder('summary')
			.select("DATE_FORMAT(summary.createdAt, '%Y-%m')", 'month')
			.addSelect('SUM(summary.price * summary.quantity)', 'totalSales')
			.addSelect('SUM(summary.commissionAmount)', 'totalCommission')
			.where('summary.vendorId = :vendorId', { vendorId })
			.andWhere('summary.createdAt >= :startDate', { startDate: startMonth.toISOString() })
			.groupBy("DATE_FORMAT(summary.createdAt, '%Y-%m')")
			.orderBy('month', 'ASC')
			.getRawMany();
	}
}
