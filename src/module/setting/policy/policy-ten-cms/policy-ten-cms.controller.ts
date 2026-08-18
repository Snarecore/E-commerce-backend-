import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { PolicyTenCmsService } from './policy-ten-cms.service';
import { UpdatePolicyTenCmsDto } from './dto/update-policy-ten-cms.dto';
import { PolicyTenCmsInterface } from './type/policy-ten-cms.type';
import { PolicyTenCms } from './entities/policy-ten-cms.entity';

@Controller({ path: "policy-ten-cms", version: CONFIG.API_VERSION })
export class PolicyTenCmsController {
	constructor(private readonly service: PolicyTenCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyTenCmsDto
	): Promise<ApiResponse<PolicyTenCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
