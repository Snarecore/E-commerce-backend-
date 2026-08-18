import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { ContactPageCms } from './entities/contact-page-cms.entity';
import { ContactPageCmsController } from './contact-page-cms.controller';
import { ContactPageCmsService } from './contact-page-cms.service';
import { ContactPageCmsRepository } from './contact-page-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ContactPageCms])
	],
	controllers: [ContactPageCmsController],
	providers: [ContactPageCmsService, ContactPageCmsRepository, SpaceService, R2ServiceProvider],
	exports: [ContactPageCmsService, ContactPageCmsRepository]
})

export class ContactPageCmsModule {}
