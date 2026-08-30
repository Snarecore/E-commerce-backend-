import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../../space-module/space-service';
import { PolicySevenCms } from './entities/policy-seven-cms.entity';
import { PolicySevenCmsController } from './policy-seven-cms.controller';
import { PolicySevenCmsService } from './policy-seven-cms.service';
import { PolicySevenCmsRepository } from './policy-seven-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicySevenCms])
	],
	controllers: [PolicySevenCmsController],
	providers: [PolicySevenCmsService, PolicySevenCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicySevenCmsService, PolicySevenCmsRepository]
})

export class PolicySevenCmsModule {}
