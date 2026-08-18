import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseInterceptors,
    UploadedFiles,
    Query,
    UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CONFIG } from 'src/utils/config';
import { CreateThirdCategoryDto } from './dto/create-third-category.dto';
import { ThirdCategoryInterface } from './type/third-category.type';
import { ThirdCategory } from './entities/third-category.entity';
import { UpdateThirdCategoryDto } from './dto/update-third-category.dto';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { ApiResponse } from 'src/utils/response.utils';
import { ThirdCategoryService } from './third-category.service';
import { ThirdCategoryFilterDto } from './dto/third-category-filter.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';

@Controller({ path: 'third-category', version: CONFIG.API_VERSION })
export class ThirdCategoryController {
    constructor(private readonly service: ThirdCategoryService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'bannerImage', maxCount: 1 }]))
    async create(
        @Body() dto: CreateThirdCategoryDto,
        @UploadedFiles()
        files: {
            bannerImage?: UploadMulterFile;
        }
    ): Promise<ApiResponse<ThirdCategoryInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: ThirdCategoryFilterDto
    ): Promise<
        ApiResponse<{
            data: ThirdCategoryInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<ThirdCategory>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'bannerImage', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateThirdCategoryDto,
        @UploadedFiles()
        files: {
            bannerImage?: UploadMulterFile;
        }
    ): Promise<ApiResponse<ThirdCategory>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
