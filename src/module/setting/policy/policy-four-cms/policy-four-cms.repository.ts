import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { PolicyFourCms } from './entities/policy-four-cms.entity';

@Injectable()
export class PolicyFourCmsRepository extends AbstractRepository<PolicyFourCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, PolicyFourCms);
	}
}
