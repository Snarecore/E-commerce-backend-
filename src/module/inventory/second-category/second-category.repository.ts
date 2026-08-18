import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { SecondCategory } from './entities/second-category.entity';

@Injectable()
export class SecondCategoryRepository extends AbstractRepository<SecondCategory> {
	constructor(dataSource: DataSource) {
		super(dataSource, SecondCategory);
	}
}
