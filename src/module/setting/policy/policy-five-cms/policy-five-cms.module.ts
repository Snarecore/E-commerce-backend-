import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../../space-module/space-service';
import { PolicyFiveCms } from './entities/policy-five-cms.entity';
import { PolicyFiveCmsController } from './policy-five-cms.controller';
import { PolicyFiveCmsService } from './policy-five-cms.service';
import { PolicyFiveCmsRepository } from './policy-five-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyFiveCms])
	],
	controllers: [PolicyFiveCmsController],
	providers: [PolicyFiveCmsService, PolicyFiveCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyFiveCmsService, PolicyFiveCmsRepository]
})

export class PolicyFiveCmsModule {}
