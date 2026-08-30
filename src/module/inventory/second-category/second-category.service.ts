import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SecondCategoryRepository } from './second-category.repository';
import { CreateSecondCategoryDto } from './dto/create-second-category.dto';
import { SecondCategoryInterface } from './type/second-category.type';
import { SecondCategory } from './entities/second-category.entity';
import { UpdateSecondCategoryDto } from './dto/update-second-category.dto';
import { UploadMulterFile } from '../../space-module/space-service';
import { SpaceService } from '../../space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { SecondCategoryFilterDto } from './dto/second-category-filter.dto';
import { FindOptionsOrder } from 'typeorm';

@Injectable()
export class SecondCategoryService {
	constructor(
		private readonly spaceService: SpaceService,
		private readonly repository: SecondCategoryRepository
	) { }

	async create(
		dto: CreateSecondCategoryDto,
		files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<SecondCategoryInterface>> {
		try {
			const slug = this.generateSlug(dto.name);
			const existingCategory = await this.repository.findBySlug(slug);
			if (existingCategory) {
				throw new HttpException(
					'Category already exists.',
					HttpStatus.BAD_REQUEST
				);
			}

			if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(files.bannerImage[0], "second-category");
                dto.bannerImage = bannerImage;
            }

			const output = (await this.repository.create({ ...dto, slug })) as SecondCategory | null;
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

	async findAll(dto: SecondCategoryFilterDto): Promise<ApiResponse<{ data: SecondCategoryInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
			try {
				let query = {};
	
				const order: FindOptionsOrder<SecondCategory> = {
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

	async findOne(id: string): Promise<ApiResponse<SecondCategory>> {
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
		dto: UpdateSecondCategoryDto,
		files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<SecondCategory>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
			}

			if (dto.name) {
				const slug = this.generateSlug(dto.name);
				const existingCategory = await this.repository.findBySlug(slug);
				if (existingCategory && existingCategory.id !== id) {
					throw new HttpException(
						'Category already exists.',
						HttpStatus.BAD_REQUEST
					);
				}
				dto = { ...dto, slug };
			}

			const foundImage = (output as SecondCategory)?.bannerImage;
            if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(files.bannerImage[0], "second-category");
                dto.bannerImage = bannerImage;
            } else {
                dto.bannerImage = foundImage;
            }

			const response = await this.repository.update(id, dto);
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

	private generateSlug(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	}
}
