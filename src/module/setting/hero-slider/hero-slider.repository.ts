import { Injectable } from '@nestjs/common';
import { AbstractRepository } from '../../../database/abstract.repository';
import { DataSource } from 'typeorm';
import { HeroSlider } from './entities/hero-slider.entity';

@Injectable()
export class HeroSliderRepository extends AbstractRepository<HeroSlider> {
	constructor(dataSource: DataSource) {
		super(dataSource, HeroSlider);
	}
}
