import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { PolicyOneCms } from './entities/policy-one-cms.entity';
import { PolicyOneCmsController } from './policy-one-cms.controller';
import { PolicyOneCmsService } from './policy-one-cms.service';
import { PolicyOneCmsRepository } from './policy-one-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyOneCms])
	],
	controllers: [PolicyOneCmsController],
	providers: [PolicyOneCmsService, PolicyOneCmsRepository, SpaceService],
	exports: [PolicyOneCmsService, PolicyOneCmsRepository]
})

export class PolicyOneCmsModule {}
