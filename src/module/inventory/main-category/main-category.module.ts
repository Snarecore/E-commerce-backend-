import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MainCategory } from './entities/main-category.entity';
import { MainCategoryController } from './main-category.controller';
import { MainCategoryService } from './main-category.service';
import { MainCategoryRepository } from './main-category.repository';
import { SpaceService } from '../../space-module/space-service/space.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([MainCategory])
	],
	controllers: [MainCategoryController],
	providers: [MainCategoryService, MainCategoryRepository, SpaceService],
	exports: [MainCategoryService, MainCategoryRepository]
})

export class MainCategoryModule {}
