import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HeroSliderRepository } from './hero-slider.repository';
import { CreateHeroSliderDto } from './dto/create-hero-slider.dto';
import { HeroSliderInterface } from './type/hero-slider.type';
import { HeroSlider } from './entities/hero-slider.entity';
import { UpdateHeroSliderDto } from './dto/update-hero-slider.dto';
import { UploadMulterFile } from '../../space-module/space-service';
import { SpaceService } from '../../space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { HeroSliderFilterDto } from './dto/hero-slider-filter.dto';
import { FindOptionsOrder } from 'typeorm';

@Injectable()
export class HeroSliderService {
	constructor(
		private readonly spaceService: SpaceService,
		private readonly repository: HeroSliderRepository
	) { }

	async create(
		dto: CreateHeroSliderDto,
		files: {
            image?: UploadMulterFile
        }
	): Promise<ApiResponse<HeroSliderInterface>> {
		try {
			if (files && files.image) {
                const image: any = await this.spaceService.uploadFile(files.image[0], "hero-slider");
                dto.image = image;
            }
			const output = (await this.repository.create(dto)) as HeroSlider | null;
			if (!output) {
				throw new HttpException(
					'Something went wrong! Please try again.',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			return ResponseUtils.successResponseHandler(201, 'Data saved successfully.', 'data', output);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async findAll(dto: HeroSliderFilterDto): Promise<ApiResponse<{ data: HeroSliderInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
			try {
				let query = {};
	
				const order: FindOptionsOrder<HeroSlider> = {
					createdAt: 'desc'
				};
	
				const result = await this.repository.paginate({
					page: dto.page ? dto?.page : 1,
					limit: dto.limit ? dto?.limit : 10,
					query,
					order
				});
	
				const payload = {
					data: result?.data,
					total: result.total,
					page: result.page,
					limit: result.limit,
					pageCount: result.pageCount
				};
	
				return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
				throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
			}
		}

	async findOne(id: string): Promise<ApiResponse<HeroSlider>> {
		try {
			const data = await this.repository.findOne(id);
			if (!data) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
        	return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async update(
		id: string, 
		data: UpdateHeroSliderDto,
		files: {
            image?: UploadMulterFile
        }
	): Promise<ApiResponse<HeroSlider>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
			}
			const foundImage = (output as HeroSlider)?.image;
            if (files && files.image) {
                const image: any = await this.spaceService.uploadFile(files.image[0], "hero-slider");
                data.image = image;
            } else {
                data.image = foundImage;
            }
			const response = await this.repository.update(id, data);
			if (!response) {
				throw new HttpException(
					'Something went wrong! Please try again.',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', response);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async remove(id: string): Promise<ApiResponse<boolean>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
			const response = await this.repository.softDelete(id);
			const result = response !== null;
        	return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
