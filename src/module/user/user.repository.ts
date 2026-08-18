import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserRepository extends AbstractRepository<User> {
	constructor(dataSource: DataSource) {
		super(dataSource, User);
	}
}
