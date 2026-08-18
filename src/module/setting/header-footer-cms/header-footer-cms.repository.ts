import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { HeaderFooterCms } from './entities/header-footer-cms.entity';

@Injectable()
export class HeaderFooterCmsRepository extends AbstractRepository<HeaderFooterCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, HeaderFooterCms);
	}
}
