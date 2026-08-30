import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { HomePageCms } from './entities/home-page-cms.entity';
import { HomePageCmsInterface } from './type/home-page-cms.type';
import { HomePageCmsService } from './home-page-cms.service';
import { UpdateHomePageCmsDto } from './dto/update-home-page-cms.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from '../../../space-module/space-service';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';

@Controller({ path: "home-page-cms", version: CONFIG.API_VERSION })
export class HomePageCmsController {
	constructor(private readonly service: HomePageCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "bannerImage", maxCount: 1 }
        ]
    ))
	async updateOrCreateData(
		@Body() dto: UpdateHomePageCmsDto,
		@UploadedFiles() files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<HomePageCmsInterface>> {
		return await this.service.updateOrCreateData(dto, files);
	}

	@Public()
	@Get()
	async findAll(): Promise<ApiResponse<HomePageCms[]>> {
		return await this.service.findAll();
	}
}
