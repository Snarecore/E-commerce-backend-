import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { FindOptionsOrder } from 'typeorm';
import { VendorMessageRepository } from './vendor-message.repository';
import { CreateVendorMessageDto } from './dto/create-vendor-message.dto';
import { VendorMessage } from './entities/vendor-message.entity';
import { VendorMessageInterface } from './type/vendor-message.type';
import { VendorMessageFilterDto } from './dto/vendor-message-filter.dto';
import { UpdateVendorMessageDto } from './dto/update-vendor-message.dto';
import { VendorMessageFilter } from './type/vendor-message-filter.type';

@Injectable()
export class VendorMessageService {
	constructor(
		private readonly repository: VendorMessageRepository
	) { }

	async create(
		dto: CreateVendorMessageDto
	): Promise<ApiResponse<VendorMessageInterface>> {
		try {
			const output = (await this.repository.create(dto)) as VendorMessage | null;
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

	async findAll(dto: VendorMessageFilterDto, userData: any): Promise<ApiResponse<{ data: VendorMessageInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		try {
			let query: VendorMessageFilter = {};

			if (userData) {
                query.vendorId = userData?.id;
            }

			const order: FindOptionsOrder<VendorMessage> = {
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
