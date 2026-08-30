import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Orders } from './entity/order.entity';

@Injectable()
export class OrdersRepository extends AbstractRepository<Orders> {
	constructor(dataSource: DataSource) {
		super(dataSource, Orders);
	}

	async findCompletedOrdersForVendor(vendorId: string): Promise<Orders[]> {
		return this.repository
			.createQueryBuilder('orders')
			.innerJoin('orders.orderSummaries', 'summary')
			.addSelect('summary')
			.where('orders.isDeleted = false')
			.andWhere('orders.status = :status', { status: 'COMPLETED' })
			.andWhere('summary.vendorId = :vendorId', { vendorId })
			.orderBy('orders.createdAt', 'DESC')
			.getMany();
	}
}
