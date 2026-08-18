import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { CreateOrdersDto } from './dto/create-order.dto';
import { OrdersInterface } from './type/order.type';
import { UpdateOrdersDto } from './dto/update.order.dto';
import { Orders } from './entity/order.entity';
import { OrdersFilterDto } from './dto/order-filter.dto';
import { OrdersService } from './order.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Public } from 'src/decorators/public.decorator';
import { Request } from 'express';

@Controller({ path: "orders", version: CONFIG.API_VERSION })
export class OrdersController {
	constructor(private readonly service: OrdersService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.CUSTOMER)
	@Post()
	async create(
		@Body() dto: CreateOrdersDto,
		@Req() req: Request
	): Promise<ApiResponse<OrdersInterface>> {
		// @ts-ignore
		return await this.service.create(dto, req?.user?.id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	async findAll(
		@Query() dto: OrdersFilterDto
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.CUSTOMER)
	@Get('/customer-order')
	async findCustomerOrderList(
		@Query() dto: OrdersFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findCustomerOrderList(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Get('/vendor-order')
	async findVendorOrderList(
		@Query() dto: OrdersFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findVendorOrderList(dto, req?.user);
	}

	@Public()
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<OrdersInterface>> {
		return await this.service.findOne(id);
	}

	@Public()
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
