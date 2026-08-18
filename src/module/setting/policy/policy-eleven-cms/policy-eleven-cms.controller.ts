import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
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
