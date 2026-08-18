import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyOneCms } from './entities/policy-one-cms.entity';
import { PolicyOneCmsController } from './policy-one-cms.controller';
import { PolicyOneCmsService } from './policy-one-cms.service';
import { PolicyOneCmsRepository } from './policy-one-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyOneCms])
	],
	controllers: [PolicyOneCmsController],
	providers: [PolicyOneCmsService, PolicyOneCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyOneCmsService, PolicyOneCmsRepository]
})

export class PolicyOneCmsModule {}
