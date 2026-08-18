import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
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
