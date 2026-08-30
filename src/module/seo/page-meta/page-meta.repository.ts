import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { PageMeta } from './entities/page-meta.entity';

@Injectable()
export class PageMetaRepository extends AbstractRepository<PageMeta> {
	constructor(dataSource: DataSource) {
		super(dataSource, PageMeta);
	}
}
