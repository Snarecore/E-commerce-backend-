import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyFiveCmsService } from './policy-five-cms.service';
import { UpdatePolicyFiveCmsDto } from './dto/update-policy-five-cms.dto';
import { PolicyFiveCmsInterface } from './type/policy-five-cms.type';
import { PolicyFiveCms } from './entities/policy-five-cms.entity';

@Controller({ path: "policy-five-cms", version: CONFIG.API_VERSION })
export class PolicyFiveCmsController {
	constructor(private readonly service: PolicyFiveCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyFiveCmsDto
	): Promise<ApiResponse<PolicyFiveCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
