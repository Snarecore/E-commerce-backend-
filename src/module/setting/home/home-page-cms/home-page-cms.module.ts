import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { HomePageCms } from './entities/home-page-cms.entity';
import { HomePageCmsController } from './home-page-cms.controller';
import { HomePageCmsService } from './home-page-cms.service';
import { HomePageCmsRepository } from './home-page-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([HomePageCms])
	],
	controllers: [HomePageCmsController],
	providers: [HomePageCmsService, HomePageCmsRepository, SpaceService],
	exports: [HomePageCmsService, HomePageCmsRepository]
})

export class HomePageCmsModule {}
