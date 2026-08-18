import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { CommissionRateCmsService } from './commission-rate-cms.service';
import { UpdateCommissionRateCmsDto } from './dto/update-commission-rate-cms.dto';
import { CommissionRateCmsInterface } from './type/commission-rate-cms.type';
import { CommissionRateCms } from './entities/commission-rate-cms.entity';

@Controller({ path: "commission-rate-cms", version: CONFIG.API_VERSION })
export class CommissionRateCmsController {
	constructor(private readonly service: CommissionRateCmsService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	async updateOrCreateData(
		@Body() dto: UpdateCommissionRateCmsDto
	): Promise<ApiResponse<CommissionRateCmsInterface>> {
		return await this.service.updateOrCreateData(dto);
	}

	@Public()
	@Get()
	async findAll(): Promise<ApiResponse<CommissionRateCms[]>> {
		return await this.service.findAll();
	}
}
