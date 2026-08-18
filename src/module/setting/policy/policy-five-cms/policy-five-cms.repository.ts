import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyFiveCms } from './entities/policy-five-cms.entity';

@Injectable()
export class PolicyFiveCmsRepository extends AbstractRepository<PolicyFiveCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyFiveCms);
	}
}
