import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThirdCategory } from './entities/third-category.entity';
import { ThirdCategoryController } from './third-category.controller';
import { ThirdCategoryService } from './third-category.service';
import { ThirdCategoryRepository } from './third-category.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([ThirdCategory])
	],
	controllers: [ThirdCategoryController],
	providers: [ThirdCategoryService, ThirdCategoryRepository, SpaceService, R2ServiceProvider],
	exports: [ThirdCategoryService, ThirdCategoryRepository]
})

export class ThirdCategoryModule {}
