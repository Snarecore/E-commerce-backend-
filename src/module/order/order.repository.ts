import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Orders } from './entity/order.entity';

@Injectable()
export class OrdersRepository extends AbstractRepository<Orders> {
	constructor(dataSource: DataSource) {
		super(dataSource, Orders);
	}
}
