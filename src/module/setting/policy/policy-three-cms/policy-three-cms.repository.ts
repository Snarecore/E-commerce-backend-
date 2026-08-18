import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyThreeCms } from './entities/policy-three-cms.entity';

@Injectable()
export class PolicyThreeCmsRepository extends AbstractRepository<PolicyThreeCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyThreeCms);
	}
}
