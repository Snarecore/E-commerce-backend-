import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
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
