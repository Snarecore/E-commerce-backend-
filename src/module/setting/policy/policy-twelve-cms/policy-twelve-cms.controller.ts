import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
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
