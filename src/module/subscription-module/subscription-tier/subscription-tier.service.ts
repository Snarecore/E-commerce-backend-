import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { FindOptionsOrder } from 'typeorm';
import { SubscriptionTierRepository } from './subscription-tier.repository';
import { CreateSubscriptionTierDto } from './dto/create-subscription-tier.dto';
import { SubscriptionTierInterface } from './type/subscription-tier.type';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { SubscriptionTierFilterDto } from './dto/subscription-tier-filter.dto';
import { UpdateSubscriptionTierDto } from './dto/update-subscription-tier.dto';

@Injectable()
export class SubscriptionTierService {
    constructor(
        private readonly repository: SubscriptionTierRepository
    ) { }

    async create(
        dto: CreateSubscriptionTierDto
    ): Promise<ApiResponse<SubscriptionTierInterface>> {
        try {
            const output = (await this.repository.create(dto)) as SubscriptionTier | null;
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

    async findAll(dto: SubscriptionTierFilterDto): Promise<ApiResponse<{ data: SubscriptionTierInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
        try {
            let query = {};

            const order: FindOptionsOrder<SubscriptionTier> = {
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

    async findOne(id: string): Promise<ApiResponse<SubscriptionTier>> {
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
        data: UpdateSubscriptionTierDto
    ): Promise<ApiResponse<SubscriptionTier>> {
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
