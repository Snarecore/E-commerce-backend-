import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { PolicyTwoCmsService } from './policy-two-cms.service';
import { UpdatePolicyTwoCmsDto } from './dto/update-policy-two-cms.dto';
import { PolicyTwoCmsInterface } from './type/policy-two-cms.type';
import { PolicyTwoCms } from './entities/policy-two-cms.entity';

@Controller({ path: "policy-two-cms", version: CONFIG.API_VERSION })
export class PolicyTwoCmsController {
	constructor(private readonly service: PolicyTwoCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyTwoCmsDto
	): Promise<ApiResponse<PolicyTwoCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
