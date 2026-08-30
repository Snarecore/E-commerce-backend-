import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { ContactPageCms } from './entities/contact-page-cms.entity';

@Injectable()
export class ContactPageCmsRepository extends AbstractRepository<ContactPageCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, ContactPageCms);
	}
}
