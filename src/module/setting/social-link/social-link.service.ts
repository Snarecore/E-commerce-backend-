import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UploadMulterFile } from '../../space-module/space-service';
import { SpaceService } from '../../space-module/space-service/space.service';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { FindOptionsOrder } from 'typeorm';
import { SocialLinkRepository } from './social-link.repository';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { SocialLinkInterface } from './type/social-link.type';
import { SocialLink } from './entities/social-link.entity';
import { SocialLinkFilterDto } from './dto/social-link-filter.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';

@Injectable()
export class SocialLinkService {
	constructor(
		private readonly spaceService: SpaceService,
		private readonly repository: SocialLinkRepository
	) { }

	async create(
		dto: CreateSocialLinkDto,
		files: {
            icon?: UploadMulterFile
        }
	): Promise<ApiResponse<SocialLinkInterface>> {
		try {
			if (files && files.icon) {
                const icon: any = await this.spaceService.uploadFile(files.icon[0], "social-link");
                dto.icon = icon;
            }
			const output = (await this.repository.create(dto)) as SocialLink | null;
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

	async findAll(dto: SocialLinkFilterDto): Promise<ApiResponse<{ data: SocialLinkInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
			try {
				let query = {};
	
				const order: FindOptionsOrder<SocialLink> = {
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

	async findOne(id: string): Promise<ApiResponse<SocialLink>> {
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
		data: UpdateSocialLinkDto,
		files: {
            icon?: UploadMulterFile
        }
	): Promise<ApiResponse<SocialLink>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
			}
			const foundIcon = (output as SocialLink)?.icon;
            if (files && files.icon) {
                const icon: any = await this.spaceService.uploadFile(files.icon[0], "social-link");
                data.icon = icon;
            } else {
                data.icon = foundIcon;
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
