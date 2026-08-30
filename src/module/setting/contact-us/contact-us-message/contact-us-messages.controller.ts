import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CONFIG } from '../../../../utils/config';
import { ApiResponse } from '../../../../utils/response.utils';
import { ContactUsMessageService } from './contact-us-message.service';
import { CreateContactUsMessageDto } from './dto/create-contact-us-message.dto';
import { ContactUsMessageInterface } from './type/contact-us-message.type';
import { ContactUsMessage } from './entities/contact-us-message.entity';
import { UpdateContactUsMessageDto } from './dto/update-contact-us-message.dto';
import { JwtAuthGuard } from '../../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../../guards/role.guard';
import { Roles } from '../../../../decorators/role.decorator';
import { Role } from '../../../../enums/role.enum';
import { Public } from '../../../../decorators/public.decorator';
import { ContactUsMessageFilterDto } from './dto/contact-us-message-filter.dto';

@Controller({ path: "contact-us-message", version: CONFIG.API_VERSION })
export class ContactUsMessageController {
	constructor(private readonly service: ContactUsMessageService) { }

	@Public()
	@Post()
	async create(@Body() dto: CreateContactUsMessageDto): Promise<ApiResponse<ContactUsMessageInterface>> {
		return await this.service.create(dto);
	}

	// @UseGuards(JwtAuthGuard, RolesGuard)
	// @Roles(Role.ADMIN)
	// @Get()
	// async findAll(): Promise<ApiResponse<ContactUsMessage[]>> {
	// 	return await this.service.findAll();
	// }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	async findAll(
		@Query() dto: ContactUsMessageFilterDto
	): Promise<
		ApiResponse<{
			data: ContactUsMessageInterface[];
			total: number;
			page: number;
			limit: number;
			pageCount: number;
		}>
	> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<ContactUsMessage>> {
		return await this.service.findOne(id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id')
	async update(
		@Param('id') id: string, 
		@Body() dto: UpdateContactUsMessageDto
	): Promise<ApiResponse<ContactUsMessage>> {
		return await this.service.update(id, dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
