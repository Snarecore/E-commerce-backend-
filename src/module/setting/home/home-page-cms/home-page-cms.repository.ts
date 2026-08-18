import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { HomePageCms } from './entities/home-page-cms.entity';

@Injectable()
export class HomePageCmsRepository extends AbstractRepository<HomePageCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, HomePageCms);
	}
}
