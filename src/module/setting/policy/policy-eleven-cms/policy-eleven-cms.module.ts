import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../../space-module/space-service';
import { PolicyElevenCms } from './entities/policy-eleven-cms.entity';
import { PolicyElevenCmsController } from './policy-eleven-cms.controller';
import { PolicyElevenCmsService } from './policy-eleven-cms.service';
import { PolicyElevenCmsRepository } from './policy-eleven-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyElevenCms])
	],
	controllers: [PolicyElevenCmsController],
	providers: [PolicyElevenCmsService, PolicyElevenCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyElevenCmsService, PolicyElevenCmsRepository]
})

export class PolicyElevenCmsModule {}
