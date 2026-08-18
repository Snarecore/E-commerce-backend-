import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotions } from './entities/promotions.entity';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { PromotionsRepository } from './promotions.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Promotions])
	],
	controllers: [PromotionsController],
	providers: [PromotionsService, PromotionsRepository, SpaceService, R2ServiceProvider],
	exports: [PromotionsService, PromotionsRepository]
})

export class PromotionsModule {}
