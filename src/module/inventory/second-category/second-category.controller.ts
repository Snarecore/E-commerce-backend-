import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query, UseGuards } from '@nestjs/common';
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { CONFIG } from 'src/utils/config';
import { CreateSecondCategoryDto } from './dto/create-second-category.dto';
import { SecondCategoryInterface } from './type/second-category.type';
import { SecondCategory } from './entities/second-category.entity';
import { UpdateSecondCategoryDto } from './dto/update-second-category.dto';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { ApiResponse } from 'src/utils/response.utils';
import { SecondCategoryService } from './second-category.service';
import { SecondCategoryFilterDto } from './dto/second-category-filter.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';

@Controller({ path: "second-category", version: CONFIG.API_VERSION })
export class SecondCategoryController {
	constructor(private readonly service: SecondCategoryService) { }

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Post()
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "bannerImage", maxCount: 1 }
        ]
    ))
	async create(
		@Body() dto: CreateSecondCategoryDto,
		@UploadedFiles() files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<SecondCategoryInterface>> {
		return await this.service.create(dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get()
	async findAll(
		@Query() dto: SecondCategoryFilterDto
	): Promise<ApiResponse<{ data: SecondCategoryInterface[]; total: number; page: number; limit: number, pageCount: number }>> {
		return await this.service.findAll(dto);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<ApiResponse<SecondCategory>> {
		return await this.service.findOne(id);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Patch(':id')
	@UseInterceptors(FileFieldsInterceptor(
        [
            { name: "bannerImage", maxCount: 1 }
        ]
    ))
	async update(
		@Param('id') id: string, 
		@Body() dto: UpdateSecondCategoryDto,
		@UploadedFiles() files: {
            bannerImage?: UploadMulterFile
        }
	): Promise<ApiResponse<SecondCategory>> {
		return await this.service.update(id, dto, files);
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
		return await this.service.remove(id);
	}
}
