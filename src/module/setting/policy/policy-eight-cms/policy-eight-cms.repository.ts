import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyEightCms } from './entities/policy-one-cms.entity';

@Injectable()
export class PolicyEightCmsRepository extends AbstractRepository<PolicyEightCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyEightCms);
	}
}
