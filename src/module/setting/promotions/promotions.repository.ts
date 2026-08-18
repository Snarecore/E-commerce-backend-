import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Promotions } from './entities/promotions.entity';

@Injectable()
export class PromotionsRepository extends AbstractRepository<Promotions> {
	constructor(dataSource: DataSource) {
		super(dataSource, Promotions);
	}
}
