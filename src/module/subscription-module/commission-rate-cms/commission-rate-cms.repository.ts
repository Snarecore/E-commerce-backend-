import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { CommissionRateCms } from './entities/commission-rate-cms.entity';

@Injectable()
export class CommissionRateCmsRepository extends AbstractRepository<CommissionRateCms> {
	constructor(dataSource: DataSource) {
		super(dataSource, CommissionRateCms);
	}
}
