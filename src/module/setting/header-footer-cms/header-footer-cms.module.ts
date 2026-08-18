import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { HeaderFooterCms } from './entities/header-footer-cms.entity';
import { HeaderFooterCmsController } from './header-footer-cms.controller';
import { HeaderFooterCmsService } from './header-footer-cms.service';
import { HeaderFooterCmsRepository } from './header-footer-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([HeaderFooterCms])
	],
	controllers: [HeaderFooterCmsController],
	providers: [HeaderFooterCmsService, HeaderFooterCmsRepository, SpaceService, R2ServiceProvider],
	exports: [HeaderFooterCmsService, HeaderFooterCmsRepository]
})

export class HeaderFooterCmsModule {}
