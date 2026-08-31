import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { ApiResponse } from '../../utils/response.utils';
import { CreateOrdersDto } from './dto/create-order.dto';
import { OrdersInterface } from './type/order.type';
import { Orders } from './entity/order.entity';
import { OrdersFilterDto } from './dto/order-filter.dto';
import { OrdersService } from './order.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { Public } from '../../decorators/public.decorator';
import { Request } from 'express';

@Controller({ path: 'orders', version: CONFIG.API_VERSION })
export class OrdersController {
	constructor(private readonly service: OrdersService) {}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.CUSTOMER, Role.VENDOR, Role.ADMIN)
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
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.CUSTOMER)
	@Get('/customer-order')
	async findCustomerOrderList(
		@Query() dto: OrdersFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
		return await this.service.findCustomerOrderList(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Get('/vendor-order')
	async findVendorOrderList(
		@Query() dto: OrdersFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number }>> {
		return await this.service.findVendorOrderList(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id/status')
	async updateOrderStatus(
		@Param('id') id: string,
		@Body() dto: UpdateOrderStatusDto,
		@Req() req: Request
	): Promise<ApiResponse<Orders>> {
		// @ts-ignore
		return await this.service.updateOrderStatus(id, dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id/courier')
	async updateCourierInfo(
		@Param('id') id: string,
		@Body() dto: UpdateCourierDto
	): Promise<ApiResponse<Orders>> {
		return await this.service.updateCourierInfo(id, dto);
	}

	@Public()
	@Get(':id')
	async findOne(@Param('id') id: string, @Req() req: Request): Promise<ApiResponse<OrdersInterface>> {
		// @ts-ignore
		return await this.service.findOne(id, req?.user);
	}

	@Public()
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
