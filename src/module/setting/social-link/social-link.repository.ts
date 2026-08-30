import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { SocialLink } from './entities/social-link.entity';

@Injectable()
export class SocialLinkRepository extends AbstractRepository<SocialLink> {
	constructor(dataSource: DataSource) {
		super(dataSource, SocialLink);
	}
}
