import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { ShopPageCms } from './entities/shop-page-cms.entity';

@Injectable()
export class ShopPageCmsRepository extends AbstractRepository<ShopPageCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, ShopPageCms);
	}
}
