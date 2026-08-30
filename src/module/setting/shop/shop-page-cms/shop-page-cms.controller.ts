import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { ShopPageCmsService } from './shop-page-cms.service';
import { UpdateShopPageCmsDto } from './dto/update-shop-page-cms.dto';
import { ShopPageCmsInterface } from './type/shop-page-cms.type';
import { ShopPageCms } from './entities/shop-page-cms.entity';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from '../../../space-module/space-service';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';

@Controller({ path: "shop-page-cms", version: CONFIG.API_VERSION })
export class ShopPageCmsController {
	constructor(private readonly service: ShopPageCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "bannerImage", maxCount: 1 }
        ]
    ))
	async updateOrCreateData(
		@Body() dto: UpdateShopPageCmsDto,
		@UploadedFiles() files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<ShopPageCmsInterface>> {
		return await this.service.updateOrCreateData(dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
	@Get()
	async findAll(): Promise<ApiResponse<ShopPageCms[]>> {
		return await this.service.findAll();
	}
}
