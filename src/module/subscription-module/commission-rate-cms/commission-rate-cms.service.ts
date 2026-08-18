import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { CommissionRateCmsRepository } from './commission-rate-cms.repository';
import { UpdateCommissionRateCmsDto } from './dto/update-commission-rate-cms.dto';
import { CommissionRateCmsInterface } from './type/commission-rate-cms.type';
import { CommissionRateCms } from './entities/commission-rate-cms.entity';

@Injectable()
export class CommissionRateCmsService {
    constructor(
        private readonly repository: CommissionRateCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdateCommissionRateCmsDto
    ): Promise<ApiResponse<CommissionRateCmsInterface>> {
        try {
            const isExists = await this.repository.findOneByQuery();
            if (!isExists) {
                const created = await this.repository.create(dto);
                if (!created) {
                    throw new HttpException(
                        'Something went wrong! Please try again.',
                        HttpStatus.INTERNAL_SERVER_ERROR
                    );
                }
                return ResponseUtils.successResponseHandler(201, 'Data created successfully.', 'data', created);
            } else {
                const id = isExists.id;
                const updated = await this.repository.update(id, dto);
                if (!updated) {
                    throw new HttpException(
                        'Something went wrong! Please try again.',
                        HttpStatus.INTERNAL_SERVER_ERROR
                    );
                }
                return ResponseUtils.successResponseHandler(200, 'Data updated successfully.', 'data', updated);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(): Promise<ApiResponse<CommissionRateCms[]>> {
        try {
            const data = await this.repository.findAll({});
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
