import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
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
