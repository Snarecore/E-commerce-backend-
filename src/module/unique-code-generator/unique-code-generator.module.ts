import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniqueCodeGeneratorController } from './unique-code-generator.controller';
import { UniqueCodeGeneratorService } from './unique-code-generator.service';
import { UniqueCodeGeneratorRepository } from './unique-code-generator.repository';
import { UniqueCodeGenerator } from './entities/unique-code-generator.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([UniqueCodeGenerator])
	],
	controllers: [UniqueCodeGeneratorController],
	providers: [UniqueCodeGeneratorService, UniqueCodeGeneratorRepository],
	exports: [UniqueCodeGeneratorService, UniqueCodeGeneratorRepository]
})

export class UniqueCodeGeneratorModule {}
