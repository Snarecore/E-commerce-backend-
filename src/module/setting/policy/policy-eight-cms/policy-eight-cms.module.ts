import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyEightCms } from './entities/policy-one-cms.entity';
import { PolicyEightCmsController } from './policy-eight-cms.controller';
import { PolicyEightCmsService } from './policy-eight-cms.service';
import { PolicyEightCmsRepository } from './policy-eight-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyEightCms])
	],
	controllers: [PolicyEightCmsController],
	providers: [PolicyEightCmsService, PolicyEightCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyEightCmsService, PolicyEightCmsRepository]
})

export class PolicyEightCmsModule {}
