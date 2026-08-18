import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecondCategory } from './entities/second-category.entity';
import { SecondCategoryController } from './second-category.controller';
import { SecondCategoryService } from './second-category.service';
import { SecondCategoryRepository } from './second-category.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([SecondCategory])
	],
	controllers: [SecondCategoryController],
	providers: [SecondCategoryService, SecondCategoryRepository, SpaceService, R2ServiceProvider],
	exports: [SecondCategoryService, SecondCategoryRepository]
})

export class SecondCategoryModule {}
