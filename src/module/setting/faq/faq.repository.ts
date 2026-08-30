import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Faq } from './entities/faq.entity';

@Injectable()
export class FaqRepository extends AbstractRepository<Faq> {
	constructor(dataSource: DataSource) {
		super(dataSource, Faq);
	}
}
