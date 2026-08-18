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
    UseGuards,
    Query
} from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { BlogInterface } from './type/blog.type';
import { BlogFilterDto } from './dto/blog-filter.dto';
import { Blog } from './entities/blog.entity';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Controller({ path: 'blog', version: CONFIG.API_VERSION })
export class BlogController {
    constructor(private readonly service: BlogService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async create(
        @Body() dto: CreateBlogDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<BlogInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(@Query() dto: BlogFilterDto): Promise<ApiResponse<{data: BlogInterface[]; total: number; page: number; limit: number; pageCount: number;}>> {
        return await this.service.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<ApiResponse<Blog>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateBlogDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Blog>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
