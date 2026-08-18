import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { ContactUsMessage } from './entities/contact-us-message.entity';

@Injectable()
export class ContactUsMessageRepository extends AbstractRepository<ContactUsMessage> {
	constructor(dataSource: DataSource) {
		super(dataSource, ContactUsMessage);
	}
}
