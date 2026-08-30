import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from '../../../../utils/response.utils';
import { HomePageCmsInterface } from './type/home-page-cms.type';
import { HomePageCms } from './entities/home-page-cms.entity';
import { UpdateHomePageCmsDto } from './dto/update-home-page-cms.dto';
import { HomePageCmsRepository } from './home-page-cms.repository';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { UploadMulterFile } from '../../../space-module/space-service';

@Injectable()
export class HomePageCmsService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: HomePageCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdateHomePageCmsDto,
        files: {
            bannerImage?: UploadMulterFile
        }
    ): Promise<ApiResponse<HomePageCmsInterface>> {
        try {
            if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(files.bannerImage[0], "home-page");
                dto.bannerImage = bannerImage;
            }
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

    async findAll(): Promise<ApiResponse<HomePageCms[]>> {
        try {
            const data = await this.repository.findAll({});
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
