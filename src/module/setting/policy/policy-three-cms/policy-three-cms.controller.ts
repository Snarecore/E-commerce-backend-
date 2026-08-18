import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { PolicyThreeCmsService } from './policy-three-cms.service';
import { UpdatePolicyThreeCmsDto } from './dto/update-policy-three-cms.dto';
import { PolicyThreeCmsInterface } from './type/policy-three-cms.type';
import { PolicyThreeCms } from './entities/policy-three-cms.entity';

@Controller({ path: "policy-three-cms", version: CONFIG.API_VERSION })
export class PolicyThreeCmsController {
	constructor(private readonly service: PolicyThreeCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdatePolicyThreeCmsDto
	): Promise<ApiResponse<PolicyThreeCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll() {
		return await this.service.findAll();
	}
}
