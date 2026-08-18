import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyTwelveCms } from './entities/policy-twelve-cms.entity';

@Injectable()
export class PolicyTwelveCmsRepository extends AbstractRepository<PolicyTwelveCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyTwelveCms);
	}
}
