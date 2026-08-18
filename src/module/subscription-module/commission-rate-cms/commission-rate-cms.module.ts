import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';
import { CommissionRateCms } from './entities/commission-rate-cms.entity';
import { CommissionRateCmsController } from './commission-rate-cms.controller';
import { CommissionRateCmsService } from './commission-rate-cms.service';
import { CommissionRateCmsRepository } from './commission-rate-cms.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CommissionRateCms])
	],
	controllers: [CommissionRateCmsController],
	providers: [CommissionRateCmsService, CommissionRateCmsRepository, SpaceService, R2ServiceProvider],
	exports: [CommissionRateCmsService, CommissionRateCmsRepository]
})

export class CommissionRateCmsModule {}
