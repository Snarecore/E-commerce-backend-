import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from '../../../../utils/response.utils';
import { PolicyTwoCmsRepository } from './policy-two-cms.repository';
import { UpdatePolicyTwoCmsDto } from './dto/update-policy-two-cms.dto';
import { PolicyTwoCmsInterface } from './type/policy-two-cms.type';
import { PolicyTwoCms } from './entities/policy-two-cms.entity';
import { omit } from '../../../../utils/helper.utils';

@Injectable()
export class PolicyTwoCmsService {
    constructor(
        private readonly repository: PolicyTwoCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdatePolicyTwoCmsDto
    ): Promise<ApiResponse<PolicyTwoCmsInterface>> {
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

    async findAll() {
        try {
            const data = await this.repository.findAll({});
            const metaKeys = ['createdAt', 'updatedAt', 'isDeleted'] as const;
            const payload = data[0] ? omit(data[0], [...metaKeys]) : null;
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
