import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query, Patch } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { ProductReviewService } from './product-review.service';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { ProductReviewInterface, ProductReviewResponse } from './type/product-review.type';
import { ProductReview } from './entities/product-review.entity';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Request } from 'express';
import { ProductReviewFilterDto } from './dto/product-review-filter.dto';
import { UpdateProductReviewStatusDto } from './dto/update-product-review-status.dto';
import { Public } from 'src/decorators/public.decorator';

@Controller({ path: "product-review", version: CONFIG.API_VERSION })
export class ProductReviewController {
	constructor(private readonly service: ProductReviewService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.CUSTOMER)
	@Post()
	async create(@Body() dto: CreateProductReviewDto, @Req() req: Request): Promise<ApiResponse<ProductReviewInterface>> {
		return await this.service.create(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Get()
	async findAll(
		@Query() dto: ProductReviewFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: ProductReviewInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
		return await this.service.findAll(dto, req?.user);
	}

	@Public()
	@Get('/comment/:id')
	async findAllforCustomer(
		@Query() dto: ProductReviewFilterDto,
		@Param('id') id: string
	): Promise<ApiResponse<{ data: ProductReviewInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
		return await this.service.findAllforCustomer(dto, id);
	}

	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<ProductReviewResponse>> {
		return await this.service.findOne(id);
	}

	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}

	// @UseGuards(JwtAuthGuard, RolesGuard)
	// @Roles(Role.VENDOR)
	// @Patch('update-approval-status')
	// async updateApprovalStatus(
	// 	@Body() dto: UpdateProductReviewStatusDto,
	// 	@Req() req: Request
	// ): Promise<ApiResponse<ProductReviewInterface>> {
	// 	return await this.service.updateApprovalStatus(dto, req.user);
	// }
}
