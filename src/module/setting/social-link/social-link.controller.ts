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
import { UploadMulterFile } from 'src/module/space-module/space-service';
import { ApiResponse } from 'src/utils/response.utils';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { SocialLinkService } from './social-link.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { SocialLinkInterface } from './type/social-link.type';
import { SocialLinkFilterDto } from './dto/social-link-filter.dto';
import { SocialLink } from './entities/social-link.entity';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';

@Controller({ path: 'social-link', version: CONFIG.API_VERSION })
export class SocialLinkController {
    constructor(private readonly service: SocialLinkService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }]))
    async create(
        @Body() dto: CreateSocialLinkDto,
        @UploadedFiles()
        files: {
            icon?: UploadMulterFile;
        }
    ): Promise<ApiResponse<SocialLinkInterface>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: SocialLinkFilterDto
    ): Promise<
        ApiResponse<{
            data: SocialLinkInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<SocialLink>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateSocialLinkDto,
        @UploadedFiles()
        files: {
            icon?: UploadMulterFile;
        }
    ): Promise<ApiResponse<SocialLink>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
