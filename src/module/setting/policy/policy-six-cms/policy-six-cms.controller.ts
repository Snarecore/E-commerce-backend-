import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicySixCmsService } from './policy-six-cms.service';
import { UpdatePolicySixCmsDto } from './dto/update-policy-six-cms.dto';
import { PolicySixCmsInterface } from './type/policy-six-cms.type';
import { PolicySixCms } from './entities/policy-six-cms.entity';

@Controller({ path: "policy-six-cms", version: CONFIG.API_VERSION })
export class PolicySixCmsController {
	constructor(private readonly service: PolicySixCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicySixCmsDto
	): Promise<ApiResponse<PolicySixCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
