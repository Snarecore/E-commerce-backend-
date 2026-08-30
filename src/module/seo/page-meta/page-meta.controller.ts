import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Req,
    Query,
} from '@nestjs/common';
import { CONFIG } from '../../../utils/config';
import { ApiResponse } from '../../../utils/response.utils';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { PageMetaService } from './page-meta.service';
import { CreatePageMetaDto } from './dto/create-page-meta.dto';
import { PageMetaInterface } from './type/page-meta.type';
import { PageMetaFilterDto } from './dto/page-meta-filter.dto';
import { PageMeta } from './entities/page-meta.entity';
import { UpdatePageMetaDto } from './dto/update-page-meta.dto';

@Controller({ path: 'page-meta', version: CONFIG.API_VERSION })
export class PageMetaController {
    constructor(private readonly service: PageMetaService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    async create(@Body() dto: CreatePageMetaDto): Promise<ApiResponse<PageMetaInterface>> {
        return await this.service.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: PageMetaFilterDto
    ): Promise<ApiResponse<{data: PageMetaInterface[]; total: number; page: number; limit: number; pageCount: number;}>> {
        return await this.service.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<ApiResponse<PageMeta>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdatePageMetaDto): Promise<ApiResponse<PageMeta>> {
        return await this.service.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
