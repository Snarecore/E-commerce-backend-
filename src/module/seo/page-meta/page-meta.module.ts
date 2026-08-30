import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';
import { PageMeta } from './entities/page-meta.entity';
import { PageMetaController } from './page-meta.controller';
import { PageMetaService } from './page-meta.service';
import { PageMetaRepository } from './page-meta.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([PageMeta])
	],
	controllers: [PageMetaController],
	providers: [PageMetaService, PageMetaRepository, SpaceService, R2ServiceProvider],
	exports: [PageMetaService, PageMetaRepository]
})

export class PageMetaModule {}
