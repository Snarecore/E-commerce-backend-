import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CONFIG } from '../../../utils/config';
import { PopupService } from './popup.service';
import { CreatePopupDto } from './dto/create-popup.dto';
import { UpdatePopupDto } from './dto/update-popup.dto';
import { PopupFilterDto } from './dto/popup-filter.dto';
import { Popup } from './entities/popup.entity';
import { UploadMulterFile } from '../../space-module/space-service';
import { ApiResponse } from '../../../utils/response.utils';
import { Public } from '../../../decorators/public.decorator';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';

@Controller({ path: 'popups', version: CONFIG.API_VERSION })
export class PopupController {
    constructor(private readonly service: PopupService) {}

    @Public()
    @Get('active')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async getActivePopup(): Promise<ApiResponse<Popup | null>> {
        return await this.service.getActivePopup();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async create(
        @Body() dto: CreatePopupDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Popup>> {
        return await this.service.create(dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: PopupFilterDto
    ): Promise<
        ApiResponse<{
            data: Popup[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<Popup>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePopupDto,
        @UploadedFiles()
        files: {
            image?: UploadMulterFile;
        }
    ): Promise<ApiResponse<Popup>> {
        return await this.service.update(id, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
