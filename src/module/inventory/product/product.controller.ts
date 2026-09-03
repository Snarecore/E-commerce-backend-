import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query, UseGuards, Req } from '@nestjs/common';
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CONFIG } from '../../../utils/config';
import { UploadMulterFile } from '../../space-module/space-service';
import { ApiResponse } from '../../../utils/response.utils';
import { ProductService } from './product.service';
import { ProductInterface } from './type/product.type';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { Public } from '../../../decorators/public.decorator';
import { Request } from 'express';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@Controller({ path: "product", version: CONFIG.API_VERSION })
export class ProductController {
	constructor(private readonly service: ProductService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR, Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "featuredImage", maxCount: 1 },
			{ name: 'productImages', maxCount: 5 },
			{ name: 'fileUrl', maxCount: 1 }
        ]
    ))
	async create(
		@Body() dto: CreateProductDto,
		@UploadedFiles() files: {
            featuredImage?: UploadMulterFile,
			productImages?: UploadMulterFile[],
			fileUrl?: UploadMulterFile
        },
		@Req() req: Request
	): Promise<ApiResponse<ProductInterface>> {
		return await this.service.create(dto, files, req?.user);
	}

	@Public()
	@Get()
	async findAll(
		@Query() dto: ProductFilterDto
	): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get('/admin-products')
	async findAllForAdmin(
		@Query() dto: ProductFilterDto
	): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAllForAdmin(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
	@Get('/vendor-products')
	async findAllForVendor(
		@Query() dto: ProductFilterDto,
		@Req() req: Request
	): Promise<ApiResponse<{ data: ProductInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAllForVendor(dto, req?.user);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN, Role.VENDOR)
	@Get('/admin-product/:id')
	async findOneForAdmin(@Param('id') id: string): Promise<ApiResponse<ProductInterface>> {
		return await this.service.findOneForAdmin(id);
	}

	@Public()
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<ProductInterface>> {
		return await this.service.findOne(id);
	}

	@Public()
	@Patch(':id')
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "featuredImage", maxCount: 1 },
			{ name: 'productImages', maxCount: 5 },
			{name: 'fileUrl', maxCount: 1}
        ]
    ))
	async update(
		@Param('id') id: string, 
		@Body() dto: UpdateProductDto,
		@UploadedFiles() files: {
            featuredImage?: UploadMulterFile,
			productImages?: UploadMulterFile[],
			fileUrl?: UploadMulterFile[]
        }
	): Promise<ApiResponse<Product>> {
		return await this.service.update(id, dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch('/update-status/:id')
	async updateProductStaus(
		@Param('id') id: string,
		@Body() dto: UpdateProductStatusDto
	): Promise<ApiResponse<Product>> {
		return await this.service.updateProductStaus(id, dto);
	}

	@Public()
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
