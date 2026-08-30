import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicySevenCmsService } from './policy-seven-cms.service';
import { UpdatePolicySevenCmsDto } from './dto/update-policy-seven-cms.dto';
import { PolicySevenCmsInterface } from './type/policy-seven-cms.type';
import { PolicySevenCms } from './entities/policy-seven-cms.entity';

@Controller({ path: "policy-seven-cms", version: CONFIG.API_VERSION })
export class PolicySevenCmsController {
	constructor(private readonly service: PolicySevenCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicySevenCmsDto
	): Promise<ApiResponse<PolicySevenCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
