import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { VendorMessage } from './entities/vendor-message.entity';

@Injectable()
export class VendorMessageRepository extends AbstractRepository<VendorMessage> {
	constructor(dataSource: DataSource) {
		super(dataSource, VendorMessage);
	}
}
