import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { MainCategory } from './entities/main-category.entity';

@Injectable()
export class MainCategoryRepository extends AbstractRepository<MainCategory> {
	constructor(dataSource: DataSource) {
		super(dataSource, MainCategory);
	}
}
