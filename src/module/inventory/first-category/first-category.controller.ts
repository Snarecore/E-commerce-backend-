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
import { CONFIG } from '../../../utils/config';
import { FirstCategoryService } from './first-category.service';
import { CreateFirstCategoryDto } from './dto/create-first-category.dto';
import { FirstCategoryInterface } from './type/first-category.type';
import { FirstCategory } from './entities/first-category.entity';
import { UpdateFirstCategoryDto } from './dto/update-first-category.dto';
import { UploadMulterFile } from '../../space-module/space-service';
import { ApiResponse } from '../../../utils/response.utils';
import { FirstCategoryFilterDto } from './dto/first-category-filter.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';

@Controller({ path: 'first-category', version: CONFIG.API_VERSION })
export class FirstCategoryController {
    constructor(private readonly service: FirstCategoryService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'bannerImage', maxCount: 1 }, { name: 'image', maxCount: 1 }]))
    async create(
        @Body() dto: CreateFirstCategoryDto,
        @UploadedFiles()
        files: {
            bannerImage?: UploadMulterFile;
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<FirstCategoryInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: FirstCategoryFilterDto
    ): Promise<
        ApiResponse<{
            data: FirstCategoryInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<FirstCategory>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'bannerImage', maxCount: 1 }, { name: 'image', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateFirstCategoryDto,
        @UploadedFiles()
        files: {
            bannerImage?: UploadMulterFile;
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<FirstCategory>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
