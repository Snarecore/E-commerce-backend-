import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicySevenCms } from './entities/policy-seven-cms.entity';

@Injectable()
export class PolicySevenCmsRepository extends AbstractRepository<PolicySevenCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicySevenCms);
	}
}
