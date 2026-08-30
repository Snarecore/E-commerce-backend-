import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyNineCmsService } from './policy-nine-cms.service';
import { UpdatePolicyNineCmsDto } from './dto/update-policy-nine-cms.dto';
import { PolicyNineCmsInterface } from './type/policy-nine-cms.type';
import { PolicyNineCms } from './entities/policy-nine-cms.entity';

@Controller({ path: "policy-nine-cms", version: CONFIG.API_VERSION })
export class PolicyNineCmsController {
	constructor(private readonly service: PolicyNineCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyNineCmsDto
	): Promise<ApiResponse<PolicyNineCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
