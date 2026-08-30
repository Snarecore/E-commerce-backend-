import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyElevenCmsService } from './policy-eleven-cms.service';
import { UpdatePolicyElevenCmsDto } from './dto/update-policy-eleven-cms.dto';
import { PolicyElevenCmsInterface } from './type/policy-eleven-cms.type';
import { PolicyElevenCms } from './entities/policy-eleven-cms.entity';

@Controller({ path: "policy-eleven-cms", version: CONFIG.API_VERSION })
export class PolicyElevenCmsController {
	constructor(private readonly service: PolicyElevenCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyElevenCmsDto
	): Promise<ApiResponse<PolicyElevenCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
