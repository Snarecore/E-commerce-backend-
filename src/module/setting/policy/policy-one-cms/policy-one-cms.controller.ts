import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { PolicyOneCmsService } from './policy-one-cms.service';
import { UpdatePolicyOneCmsDto } from './dto/update-policy-one-cms.dto';
import { PolicyOneCmsInterface } from './type/policy-one-cms.type';
import { PolicyOneCms } from './entities/policy-one-cms.entity';

@Controller({ path: "policy-one-cms", version: CONFIG.API_VERSION })
export class PolicyOneCmsController {
	constructor(private readonly service: PolicyOneCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyOneCmsDto
	): Promise<ApiResponse<PolicyOneCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
