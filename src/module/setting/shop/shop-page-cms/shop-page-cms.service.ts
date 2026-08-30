import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from '../../../../utils/response.utils';
import { ShopPageCmsRepository } from './shop-page-cms.repository';
import { UpdateShopPageCmsDto } from './dto/update-shop-page-cms.dto';
import { ShopPageCmsInterface } from './type/shop-page-cms.type';
import { ShopPageCms } from './entities/shop-page-cms.entity';
import { SpaceService } from '../../../space-module/space-service/space.service';
import { UploadMulterFile } from '../../../space-module/space-service';

@Injectable()
export class ShopPageCmsService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: ShopPageCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdateShopPageCmsDto,
        files: {
            bannerImage?: UploadMulterFile
        }
    ): Promise<ApiResponse<ShopPageCmsInterface>> {
        try {
            if (files && files.bannerImage) {
                const bannerImage: any = await this.spaceService.uploadFile(files.bannerImage[0], "shop-page");
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

    async findAll(): Promise<ApiResponse<ShopPageCms[]>> {
        try {
            const data = await this.repository.findAll({});
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
