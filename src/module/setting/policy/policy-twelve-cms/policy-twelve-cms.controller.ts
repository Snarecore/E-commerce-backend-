import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyTwelveCmsService } from './policy-twelve-cms.service';
import { UpdatePolicyTwelveCmsDto } from './dto/update-policy-twelve-cms.dto';
import { PolicyTwelveCmsInterface } from './type/policy-twelve-cms.type';
import { PolicyTwelveCms } from './entities/policy-twelve-cms.entity';

@Controller({ path: "policy-twelve-cms", version: CONFIG.API_VERSION })
export class PolicyTwelveCmsController {
	constructor(private readonly service: PolicyTwelveCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyTwelveCmsDto
	): Promise<ApiResponse<PolicyTwelveCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
