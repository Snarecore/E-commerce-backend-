import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyEightCmsService } from './policy-eight-cms.service';
import { UpdatePolicyEightCmsDto } from './dto/update-policy-eight-cms.dto';
import { PolicyEightCmsInterface } from './type/policy-eight-cms.type';
import { PolicyEightCms } from './entities/policy-one-cms.entity';

@Controller({ path: "policy-eight-cms", version: CONFIG.API_VERSION })
export class PolicyEightCmsController {
	constructor(private readonly service: PolicyEightCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyEightCmsDto
	): Promise<ApiResponse<PolicyEightCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
