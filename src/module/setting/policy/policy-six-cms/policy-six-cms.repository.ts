import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicySixCms } from './entities/policy-six-cms.entity';

@Injectable()
export class PolicySixCmsRepository extends AbstractRepository<PolicySixCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicySixCms);
	}
}
