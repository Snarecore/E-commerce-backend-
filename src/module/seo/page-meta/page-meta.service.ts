import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { FindOptionsOrder } from 'typeorm';
import { PageMetaRepository } from './page-meta.repository';
import { CreatePageMetaDto } from './dto/create-page-meta.dto';
import { PageMetaInterface } from './type/page-meta.type';
import { PageMeta } from './entities/page-meta.entity';
import { PageMetaFilterDto } from './dto/page-meta-filter.dto';
import { UpdatePageMetaDto } from './dto/update-page-meta.dto';

@Injectable()
export class PageMetaService {
	constructor(
		private readonly repository: PageMetaRepository
	) { }

	async create(
		dto: CreatePageMetaDto
	): Promise<ApiResponse<PageMetaInterface>> {
		try {
			const output = (await this.repository.create(dto)) as PageMeta | null;
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

	async findAll(dto: PageMetaFilterDto): Promise<ApiResponse<{ data: PageMetaInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		try {
			let query = {};

			const order: FindOptionsOrder<PageMeta> = {
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

	async findOne(id: string): Promise<ApiResponse<PageMeta>> {
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
		data: UpdatePageMetaDto
	): Promise<ApiResponse<PageMeta>> {
		try {
			const output = await this.repository.findOne(id);
			if (!output) {
				throw new HttpException('Data does not exist!', HttpStatus.BAD_REQUEST);
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
