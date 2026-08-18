import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { ThirdCategory } from './entities/third-category.entity';

@Injectable()
export class ThirdCategoryRepository extends AbstractRepository<ThirdCategory> {
	constructor(dataSource: DataSource) {
		super(dataSource, ThirdCategory);
	}
}
