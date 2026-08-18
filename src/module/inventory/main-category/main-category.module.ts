import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MainCategory } from './entities/main-category.entity';
import { MainCategoryController } from './main-category.controller';
import { MainCategoryService } from './main-category.service';
import { MainCategoryRepository } from './main-category.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([MainCategory])
	],
	controllers: [MainCategoryController],
	providers: [MainCategoryService, MainCategoryRepository, SpaceService, R2ServiceProvider],
	exports: [MainCategoryService, MainCategoryRepository]
})

export class MainCategoryModule {}
