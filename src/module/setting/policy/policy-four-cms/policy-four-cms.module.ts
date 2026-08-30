import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../../space-module/space-service';
import { PolicyFourCms } from './entities/policy-four-cms.entity';
import { PolicyFourCmsController } from './policy-four-cms.controller';
import { PolicyFourCmsService } from './policy-four-cms.service';
import { PolicyFourCmsRepository } from './policy-four-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyFourCms])
	],
	controllers: [PolicyFourCmsController],
	providers: [PolicyFourCmsService, PolicyFourCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyFourCmsService, PolicyFourCmsRepository]
})

export class PolicyFourCmsModule {}
