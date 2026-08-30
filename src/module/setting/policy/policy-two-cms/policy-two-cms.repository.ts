import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyTwoCms } from './entities/policy-two-cms.entity';

@Injectable()
export class PolicyTwoCmsRepository extends AbstractRepository<PolicyTwoCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyTwoCms);
	}
}
