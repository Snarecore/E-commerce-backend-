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
import { HeroSliderService } from './hero-slider.service';
import { CreateHeroSliderDto } from './dto/create-hero-slider.dto';
import { HeroSliderInterface } from './type/hero-slider.type';
import { HeroSlider } from './entities/hero-slider.entity';
import { UpdateHeroSliderDto } from './dto/update-hero-slider.dto';
import { UploadMulterFile } from '../../space-module/space-service';
import { ApiResponse } from '../../../utils/response.utils';
import { HeroSliderFilterDto } from './dto/hero-slider-filter.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';

@Controller({ path: 'hero-slider', version: CONFIG.API_VERSION })
export class HeroSliderController {
    constructor(private readonly service: HeroSliderService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async create(
        @Body() dto: CreateHeroSliderDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<HeroSliderInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: HeroSliderFilterDto
    ): Promise<
        ApiResponse<{
            data: HeroSliderInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<HeroSlider>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateHeroSliderDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<HeroSlider>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
