import { Controller, Get, Post, Body, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../utils/config';
import { ApiResponse, ResponseUtils } from '../../../utils/response.utils';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from '../../space-module/space-service';
import { HeaderFooterCmsService } from './header-footer-cms.service';
import { UpdateHeaderFooterCmsDto } from './dto/update-header-footer-cms.dto';
import { HeaderFooterCmsInterface } from './type/header-footer-cms.type';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { HeaderFooterCms } from './entities/header-footer-cms.entity';
import { Public } from '../../../decorators/public.decorator';

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

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post('theme')
	async updateTheme(
		@Body() body: { primaryColor?: string; secondaryColor?: string; themeConfig?: any }
	): Promise<ApiResponse<any>> {
		return await this.service.updateTheme(body);
	}

	@Public()
	@Get('theme')
	async getTheme(): Promise<ApiResponse<any>> {
		const result = await this.service.findAll();
		const data = result?.data?.[0];
		return ResponseUtils.successResponseHandler(200, 'Theme retrieved successfully.', 'data', {
			primaryColor: data?.primaryColor || '#218DAE',
			secondaryColor: data?.secondaryColor || '#1D7693',
			themeConfig: data?.themeConfig || null,
		});
	}
}
