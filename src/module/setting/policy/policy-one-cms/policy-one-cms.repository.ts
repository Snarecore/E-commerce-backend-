import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyOneCms } from './entities/policy-one-cms.entity';

@Injectable()
export class PolicyOneCmsRepository extends AbstractRepository<PolicyOneCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyOneCms);
	}
}
