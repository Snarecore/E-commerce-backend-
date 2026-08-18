import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { Blog } from './entities/blog.entity';

@Injectable()
export class BlogRepository extends AbstractRepository<Blog> {
	constructor(dataSource: DataSource) {
		super(dataSource, Blog);
	}
}
