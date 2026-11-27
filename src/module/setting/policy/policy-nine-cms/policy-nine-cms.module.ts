import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { PolicyNineCms } from './entities/policy-nine-cms.entity';
import { PolicyNineCmsController } from './policy-nine-cms.controller';
import { PolicyNineCmsService } from './policy-nine-cms.service';
import { PolicyNineCmsRepository } from './policy-nine-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyNineCms])
	],
	controllers: [PolicyNineCmsController],
	providers: [PolicyNineCmsService, PolicyNineCmsRepository, SpaceService],
	exports: [PolicyNineCmsService, PolicyNineCmsRepository]
})

export class PolicyNineCmsModule {}
