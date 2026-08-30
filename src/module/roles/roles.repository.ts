import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { Roles } from './entities/role.entity';

@Injectable()
export class RolesRepository extends AbstractRepository<Roles> {
	constructor(dataSource: DataSource) {
		super(dataSource, Roles);
	}
}
