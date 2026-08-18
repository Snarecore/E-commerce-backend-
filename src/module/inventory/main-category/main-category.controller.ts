import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query, UseGuards, Req } from '@nestjs/common';
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CONFIG } from 'src/utils/config';
import { MainCategoryService } from './main-category.service';
import { CreateMainCategoryDto } from './dto/create-main-category.dto';
import { MainCategoryInterface } from './type/main-category.type';
import { MainCategory } from './entities/main-category.entity';
import { UpdateMainCategoryDto } from './dto/update-main-category.dto';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { ApiResponse } from 'src/utils/response.utils';
import { MainCategoryFilterDto } from './dto/main-category-filter.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';

@Controller({ path: "main-category", version: CONFIG.API_VERSION })
export class MainCategoryController {
	constructor(private readonly service: MainCategoryService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "image", maxCount: 1 },
			{ name: "bannerImage", maxCount: 1 }
        ]
    ))
	async create(
		@Body() dto: CreateMainCategoryDto,
		@UploadedFiles() files: {
            image?: UploadMulterFile,
			bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<MainCategoryInterface>> {
		return await this.service.create(dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	async findAll(
		@Query() dto: MainCategoryFilterDto
	): Promise<ApiResponse<{ data: MainCategoryInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<MainCategory>> {
		return await this.service.findOne(id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id')
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "image", maxCount: 1 },
			{ name: "bannerImage", maxCount: 1 }
        ]
    ))
	async update(
		@Param('id') id: string, 
		@Body() dto: UpdateMainCategoryDto,
		@UploadedFiles() files: {
            image?: UploadMulterFile,
			bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<MainCategory>> {
		return await this.service.update(id, dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
