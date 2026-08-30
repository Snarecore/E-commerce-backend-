import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirstCategory } from './entities/first-category.entity';
import { FirstCategoryController } from './first-category.controller';
import { FirstCategoryService } from './first-category.service';
import { FirstCategoryRepository } from './first-category.repository';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([FirstCategory])
	],
	controllers: [FirstCategoryController],
	providers: [FirstCategoryService, FirstCategoryRepository, SpaceService, R2ServiceProvider],
	exports: [FirstCategoryService, FirstCategoryRepository]
})

export class FirstCategoryModule {}
