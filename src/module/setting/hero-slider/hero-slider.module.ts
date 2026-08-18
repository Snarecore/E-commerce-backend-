import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroSlider } from './entities/hero-slider.entity';
import { HeroSliderController } from './hero-slider.controller';
import { HeroSliderService } from './hero-slider.service';
import { HeroSliderRepository } from './hero-slider.repository';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { R2ServiceProvider } from 'src/module/space-module/space-service';

@Module({
	imports: [
		TypeOrmModule.forFeature([HeroSlider])
	],
	controllers: [HeroSliderController],
	providers: [HeroSliderService, HeroSliderRepository, SpaceService, R2ServiceProvider],
	exports: [HeroSliderService, HeroSliderRepository]
})

export class HeroSliderModule {}
