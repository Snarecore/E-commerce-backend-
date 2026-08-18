import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { HeaderFooterCmsService } from './header-footer-cms.service';
import { UpdateHeaderFooterCmsDto } from './dto/update-header-footer-cms.dto';
import { HeaderFooterCmsInterface } from './type/header-footer-cms.type';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { HeaderFooterCms } from './entities/header-footer-cms.entity';

@Controller({ path: "header-footer-cms", version: CONFIG.API_VERSION })
export class HeaderFooterCmsController {
	constructor(private readonly service: HeaderFooterCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "headerLogo", maxCount: 1 },
			{ name: "footerLogo", maxCount: 1 }
        ]
    ))
	async updateOrCreateData(
		@Body() dto: UpdateHeaderFooterCmsDto,
		@UploadedFiles() files: {
            headerLogo?: UploadMulterFile,
			footerLogo?: UploadMulterFile
        }
	): Promise<ApiResponse<HeaderFooterCmsInterface>> {
		return await this.service.updateOrCreateData(dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
	@Get()
	async findAll(): Promise<ApiResponse<HeaderFooterCms[]>> {
		return await this.service.findAll();
	}
}
