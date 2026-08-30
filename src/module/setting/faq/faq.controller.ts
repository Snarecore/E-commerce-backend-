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
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { FaqInterface } from './type/faq.type';
import { Faq } from './entities/faq.entity';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { FaqFilterDto } from './dto/faq-filter.dto';

@Controller({ path: 'faq', version: CONFIG.API_VERSION })
export class FaqController {
    constructor(private readonly service: FaqService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    async create(@Body() dto: CreateFaqDto): Promise<ApiResponse<FaqInterface>> {
        return await this.service.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: FaqFilterDto
    ): Promise<
        ApiResponse<{
            data: FaqInterface[];
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
    async findOne(@Param('id') id: string): Promise<ApiResponse<Faq>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateFaqDto): Promise<ApiResponse<Faq>> {
        return await this.service.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
