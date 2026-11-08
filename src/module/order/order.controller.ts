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

@Controller({ path: 'orders', version: CONFIG.API_VERSION })
export class OrdersController {
	constructor(private readonly service: OrdersService) {}

	@Public()
	@Post('preview')
	async preview(
		@Body() dto: any,
		@Req() req: Request
	): Promise<ApiResponse<any>> {
		let userId = (req as any)?.user?.id || (req as any)?.user?.userId;
		if (!userId && req.headers?.authorization) {
			try {
				const authHeader = req.headers.authorization;
				const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
				if (token) {
					const payloadPart = token.split('.')[1];
					if (payloadPart) {
						const decoded = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
						userId = decoded?.id || decoded?.userId || decoded?.sub;
					}
				}
			} catch {}
		}
		if (!userId && (req as any)?.cookies) {
			try {
				const cookies = (req as any).cookies;
				const token = cookies['cloth_customer_access'] || cookies['cloth_admin_access'] || cookies['accessToken'];
				if (token) {
					const payloadPart = token.split('.')[1];
					if (payloadPart) {
						const decoded = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
						userId = decoded?.id || decoded?.userId || decoded?.sub;
					}
				}
			} catch {}
		}
		dto.userId = userId || (dto as any)?.userId || null;
		return await this.service.calculateOrderPreview(dto);
	}

	@Public()
	@Post()
	async create(
		@Body() dto: CreateOrdersDto,
		@Req() req: Request
	): Promise<ApiResponse<OrdersInterface>> {
		let userId = (req as any)?.user?.id || (req as any)?.user?.userId;
		if (!userId && req.headers?.authorization) {
			try {
				const authHeader = req.headers.authorization;
				const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
				if (token) {
					const payloadPart = token.split('.')[1];
					if (payloadPart) {
						const decoded = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
						userId = decoded?.id || decoded?.userId || decoded?.sub;
					}
				}
			} catch {}
		}
		if (!userId && (req as any)?.cookies) {
			try {
				const cookies = (req as any).cookies;
				const token = cookies['cloth_customer_access'] || cookies['cloth_admin_access'] || cookies['accessToken'];
				if (token) {
					const payloadPart = token.split('.')[1];
					if (payloadPart) {
						const decoded = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
						userId = decoded?.id || decoded?.userId || decoded?.sub;
					}
				}
			} catch {}
		}
		userId = userId || (dto as any)?.userId || null;
		return await this.service.create(dto, userId);
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
	@Get(':id')
	async findOne(@Param('id') id: string, @Req() req: Request): Promise<ApiResponse<OrdersInterface>> {
		// @ts-ignore
		return await this.service.findOne(id, req?.user);
	}

	@UseGuards(OptionalJwtAuthGuard)
	@Post(':id/restore-cart')
	async restoreCart(
		@Param('id') id: string,
		@Headers('x-guest-order-token') guestToken: string,
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
