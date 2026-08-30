import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyFourCmsService } from './policy-four-cms.service';
import { UpdatePolicyFourCmsDto } from './dto/update-policy-four-cms.dto';
import { PolicyFourCmsInterface } from './type/policy-four-cms.type';
import { PolicyFourCms } from './entities/policy-four-cms.entity';

@Controller({ path: "policy-four-cms", version: CONFIG.API_VERSION })
export class PolicyFourCmsController {
	constructor(private readonly service: PolicyFourCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyFourCmsDto
	): Promise<ApiResponse<PolicyFourCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
