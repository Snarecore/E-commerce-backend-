import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../../space-module/space-service';
import { ShopPageCms } from './entities/shop-page-cms.entity';
import { ShopPageCmsController } from './shop-page-cms.controller';
import { ShopPageCmsService } from './shop-page-cms.service';
import { ShopPageCmsRepository } from './shop-page-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ShopPageCms])
	],
	controllers: [ShopPageCmsController],
	providers: [ShopPageCmsService, ShopPageCmsRepository, SpaceService, R2ServiceProvider],
	exports: [ShopPageCmsService, ShopPageCmsRepository]
})

export class ShopPageCmsModule {}
