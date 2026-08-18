import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyElevenCms } from './entities/policy-eleven-cms.entity';

@Injectable()
export class PolicyElevenCmsRepository extends AbstractRepository<PolicyElevenCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyElevenCms);
	}
}
