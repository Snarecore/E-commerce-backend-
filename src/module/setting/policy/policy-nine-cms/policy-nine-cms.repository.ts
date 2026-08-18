import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyNineCms } from './entities/policy-nine-cms.entity';

@Injectable()
export class PolicyNineCmsRepository extends AbstractRepository<PolicyNineCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyNineCms);
	}
}
