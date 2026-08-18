import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { ContactPageCms } from './entities/contact-page-cms.entity';
import { UpdateContactPageCmsDto } from './dto/update-contact-page-cms.dto';
import { ContactPageCmsInterface } from './type/contact-page-cms.type';
import { ContactPageCmsService } from './contact-page-cms.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';

@Controller({ path: "contact-page-cms", version: CONFIG.API_VERSION })
export class ContactPageCmsController {
	constructor(private readonly service: ContactPageCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdateContactPageCmsDto
	): Promise<ApiResponse<ContactPageCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
