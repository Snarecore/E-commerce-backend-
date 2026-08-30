import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { FirstCategory } from './entities/first-category.entity';

@Injectable()
export class FirstCategoryRepository extends AbstractRepository<FirstCategory> {
	constructor(dataSource: DataSource) {
		super(dataSource, FirstCategory);
	}
}
