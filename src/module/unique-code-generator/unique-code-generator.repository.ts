import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { UniqueCodeGenerator } from './entities/unique-code-generator.entity';

@Injectable()
export class UniqueCodeGeneratorRepository extends AbstractRepository<UniqueCodeGenerator> {
	constructor(dataSource: DataSource) {
		super(dataSource, UniqueCodeGenerator);
	}
}



