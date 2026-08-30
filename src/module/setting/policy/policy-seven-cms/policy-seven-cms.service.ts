import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from '../../../../utils/response.utils';
import { PolicySevenCmsRepository } from './policy-seven-cms.repository';
import { UpdatePolicySevenCmsDto } from './dto/update-policy-seven-cms.dto';
import { PolicySevenCmsInterface } from './type/policy-seven-cms.type';
import { PolicySevenCms } from './entities/policy-seven-cms.entity';
import { omit } from '../../../../utils/helper.utils';

@Injectable()
export class PolicySevenCmsService {
    constructor(
        private readonly repository: PolicySevenCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdatePolicySevenCmsDto
    ): Promise<ApiResponse<PolicySevenCmsInterface>> {
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
