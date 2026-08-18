import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { Blog } from './entities/blog.entity';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogRepository } from './blog.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Blog])
	],
	controllers: [BlogController],
	providers: [BlogService, BlogRepository, SpaceService, R2ServiceProvider],
	exports: [BlogService, BlogRepository]
})

export class BlogModule {}
