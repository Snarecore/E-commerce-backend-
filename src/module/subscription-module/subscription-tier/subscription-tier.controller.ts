import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query
} from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { ApiResponse } from 'src/utils/response.utils';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { CreateSubscriptionTierDto } from './dto/create-subscription-tier.dto';
import { SubscriptionTierInterface } from './type/subscription-tier.type';
import { SubscriptionTierFilterDto } from './dto/subscription-tier-filter.dto';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { UpdateSubscriptionTierDto } from './dto/update-subscription-tier.dto';
import { SubscriptionTierService } from './subscription-tier.service';

@Controller({ path: 'subscription-tier', version: CONFIG.API_VERSION })
export class SubscriptionTierController {
    constructor(private readonly service: SubscriptionTierService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    async create(@Body() dto: CreateSubscriptionTierDto): Promise<ApiResponse<SubscriptionTierInterface>> {
        return await this.service.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(
        @Query() dto: SubscriptionTierFilterDto
    ): Promise<ApiResponse<{data: SubscriptionTierInterface[]; total: number; page: number; limit: number; pageCount: number;}>> {
        return await this.service.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<ApiResponse<SubscriptionTier>> {
        return await this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionTierDto): Promise<ApiResponse<SubscriptionTier>> {
        return await this.service.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.service.remove(id);
    }
}
