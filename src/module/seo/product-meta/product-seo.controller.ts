import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CreateOrUpdateProductSeoDto } from './dto/product-seo.dto';
import { ProductSeoService } from './product-seo.service';
import { ProductSeo } from './entity/product-seo.entity';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { ApiResponse, ResponseUtils } from '../../../utils/response.utils';
import { CONFIG } from '../../../utils/config';
import { ProductMetaFilterDto } from './dto/product-meta-filter.dto';

@Controller({ path: 'product-seo', version: CONFIG.API_VERSION })
export class ProductSeoController {
    constructor(private readonly service: ProductSeoService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch()
    async upsertSeo(@Body() dto: CreateOrUpdateProductSeoDto) {
        return await this.service.upsertProductSeo(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('/synchronize')
    async syncProductSeo(): Promise<ApiResponse<any>> {
        await this.service.syncProductSeoData();
        return ResponseUtils.successResponseHandler(200, 'Product data synced successfully.', 'data', {});
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('/find-all')
    async findAll(
        @Query() dto: ProductMetaFilterDto
    ): Promise<ApiResponse<{data: any[]; total: number; page: number; limit: number; pageCount: number;}>> {
        return await this.service.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('/:productId')
    async getSeo(@Param('productId') productId: string): Promise<ProductSeo> {
        return await this.service.getSeoByProduct(productId);
    }
}
