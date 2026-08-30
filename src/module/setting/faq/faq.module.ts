import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceService } from '../../space-module/space-service/space.service';
import { R2ServiceProvider } from '../../space-module/space-service';
import { Faq } from './entities/faq.entity';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { FaqRepository } from './faq.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Faq])
	],
	controllers: [FaqController],
	providers: [FaqService, FaqRepository, SpaceService, R2ServiceProvider],
	exports: [FaqService, FaqRepository]
})

export class FaqModule {}
