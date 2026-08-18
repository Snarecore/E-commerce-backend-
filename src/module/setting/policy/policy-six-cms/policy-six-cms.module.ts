import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicySixCms } from './entities/policy-six-cms.entity';
import { PolicySixCmsController } from './policy-six-cms.controller';
import { PolicySixCmsService } from './policy-six-cms.service';
import { PolicySixCmsRepository } from './policy-six-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicySixCms])
	],
	controllers: [PolicySixCmsController],
	providers: [PolicySixCmsService, PolicySixCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicySixCmsService, PolicySixCmsRepository]
})

export class PolicySixCmsModule {}
