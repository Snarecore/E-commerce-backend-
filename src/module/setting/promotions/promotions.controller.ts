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
import { PromotionsService } from './promotions.service';
import { CreatePromotionsDto } from './dto/create-promotions.dto';
import { PromotionsInterface } from './type/promotions.type';
import { Promotions } from './entities/promotions.entity';
import { UpdatePromotionsDto } from './dto/update-promotions.dto';
import { UploadMulterFile } from '../../space-module/space-service';
import { ApiResponse } from '../../../utils/response.utils';
import { PromotionFilterDto } from './dto/promotion-filter.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';

@Controller({ path: 'promotions', version: CONFIG.API_VERSION })
export class PromotionsController {
    constructor(private readonly service: PromotionsService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async create(
        @Body() dto: CreatePromotionsDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<PromotionsInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: PromotionFilterDto
    ): Promise<
        ApiResponse<{
            data: PromotionsInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<Promotions>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePromotionsDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Promotions>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
