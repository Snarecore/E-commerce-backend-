import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, Headers } from '@nestjs/common';
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
import { OptionalJwtAuthGuard } from '../../guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { Public } from '../../decorators/public.decorator';
import { Request } from 'express';
import { GUEST_ORDER_TOKEN_HEADER } from './utils/order-access.policy';

@Controller({ path: 'orders', version: CONFIG.API_VERSION })
export class OrdersController {
	constructor(private readonly service: OrdersService) {}

	// Guest or signed-in. The owner comes only from a verified token, never from the body.
	@Public()
	@UseGuards(OptionalJwtAuthGuard)
	@Post('preview')
	async preview(
		@Body() dto: any,
		@Req() req: Request
	): Promise<ApiResponse<any>> {
		dto.userId = (req.user as any)?.id ?? null;
		return await this.service.calculateOrderPreview(dto);
	}

	@Public()
	@UseGuards(OptionalJwtAuthGuard)
	@Post()
	async create(
		@Body() dto: CreateOrdersDto,
		@Req() req: Request
	): Promise<ApiResponse<OrdersInterface>> {
		return await this.service.create(dto, (req.user as any)?.id ?? null);
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
	): Promise<ApiResponse<{ data: OrdersInterface[]; total: number; page: number; limit: number; pageCount: number; statusCounts?: Record<string, number> }>> {
		return await this.service.findCustomerOrderList(dto, req?.user);
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
	@Get('track')
	async trackOrder(
		@Query('orderId') orderId: string,
		@Query('phone') phone: string
	): Promise<ApiResponse<any>> {
		return await this.service.trackOrder(orderId, phone);
	}

	// Admin, the owning customer, or a guest holding the order's signed token (see order-access.policy)
	@Public()
	@UseGuards(OptionalJwtAuthGuard)
	@Get(':id')
	async findOne(
		@Param('id') id: string,
		@Headers(GUEST_ORDER_TOKEN_HEADER) guestToken: string | undefined,
		@Req() req: Request
	): Promise<ApiResponse<any>> {
		return await this.service.findOne(id, req.user, guestToken);
	}

	// Same access rule as GET :id — admin, owner, or a guest with the order's signed token;
	// enforced in the service by resolveOrderAccess, so guests must not be stopped by the JWT guard.
	@Public()
	@UseGuards(OptionalJwtAuthGuard)
	@Post(':id/restore-cart')
	async restoreCart(
		@Param('id') id: string,
		@Headers(GUEST_ORDER_TOKEN_HEADER) guestToken: string,
		@Req() req: any
	): Promise<ApiResponse<any>> {
		return await this.service.generateCartRestorePayload(id, req?.user, guestToken);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
