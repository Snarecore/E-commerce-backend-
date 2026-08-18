import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { PolicyTenCms } from './entities/policy-ten-cms.entity';
import { PolicyTenCmsController } from './policy-ten-cms.controller';
import { PolicyTenCmsService } from './policy-ten-cms.service';
import { PolicyTenCmsRepository } from './policy-ten-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PolicyTenCms])
	],
	controllers: [PolicyTenCmsController],
	providers: [PolicyTenCmsService, PolicyTenCmsRepository, SpaceService, R2ServiceProvider],
	exports: [PolicyTenCmsService, PolicyTenCmsRepository]
})

export class PolicyTenCmsModule {}
