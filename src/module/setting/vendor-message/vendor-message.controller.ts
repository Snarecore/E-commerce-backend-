import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { CONFIG } from '../../../utils/config';
import { ApiResponse } from '../../../utils/response.utils';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { Public } from '../../../decorators/public.decorator';
import { VendorMessageService } from './vendor-message.service';
import { CreateVendorMessageDto } from './dto/create-vendor-message.dto';
import { VendorMessageInterface } from './type/vendor-message.type';
import { VendorMessageFilterDto } from './dto/vendor-message-filter.dto';
import { Request } from 'express';

@Controller({ path: "vendor-message", version: CONFIG.API_VERSION })
export class VendorMessageController {
	constructor(private readonly service: VendorMessageService) { }

	@Public()
	@Post()
	async create(@Body() dto: CreateVendorMessageDto): Promise<ApiResponse<VendorMessageInterface>> {
		return await this.service.create(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Get()
	async findAll(
		@Query() dto: VendorMessageFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: VendorMessageInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
		return await this.service.findAll(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
