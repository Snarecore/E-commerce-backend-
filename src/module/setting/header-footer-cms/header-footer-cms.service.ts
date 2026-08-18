import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { HeaderFooterCmsRepository } from './header-footer-cms.repository';
import { UpdateHeaderFooterCmsDto } from './dto/update-header-footer-cms.dto';
import { HeaderFooterCmsInterface } from './type/header-footer-cms.type';
import { HeaderFooterCms } from './entities/header-footer-cms.entity';

@Injectable()
export class HeaderFooterCmsService {
    constructor(
        private readonly spaceService: SpaceService,
        private readonly repository: HeaderFooterCmsRepository
    ) { }

    async updateOrCreateData(
        dto: UpdateHeaderFooterCmsDto,
        files: {
            headerLogo?: UploadMulterFile,
            footerLogo?: UploadMulterFile
        }
    ): Promise<ApiResponse<HeaderFooterCmsInterface>> {
        try {
            if (files && files.headerLogo) {
                const headerLogo: any = await this.spaceService.uploadFile(files.headerLogo[0], "header-footer");
                dto.headerLogo = headerLogo;
            }
            if (files && files.footerLogo) {
                const footerLogo: any = await this.spaceService.uploadFile(files.footerLogo[0], "header-footer");
                dto.footerLogo = footerLogo;
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

    async findAll(): Promise<ApiResponse<HeaderFooterCms[]>> {
        try {
            const data = await this.repository.findAll({});
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
