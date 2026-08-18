import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyTenCms } from './entities/policy-ten-cms.entity';

@Injectable()
export class PolicyTenCmsRepository extends AbstractRepository<PolicyTenCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyTenCms);
	}
}
