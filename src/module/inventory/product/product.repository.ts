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
}
