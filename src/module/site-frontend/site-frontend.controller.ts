import { BadRequestException, Controller, Get, Header, Param, Query, Req, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { SiteFrontendService } from './site-frontend.service';
import { ProductFilterDto } from '../inventory/product/dto/product-filter.dto';
import { Public } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { Request } from 'express';
import { UserFilterDto } from '../user/dto/user-filter.dto';

@Controller({
    path: 'site',
    version: CONFIG.API_VERSION
})
export class SiteFrontendController {
    constructor(private readonly service: SiteFrontendService) { }
    
    @Public()
    @Get('/main-category')
    @Header('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    async getMainCategoryData() {
        return await this.service.getMainCategoryData();
    }

    @Public()
    @Get('first-categories')
    @Header('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    async getFirstCategories(@Query('mainCategoryId') mainCategoryId: string) {
        if (!mainCategoryId) {
            throw new BadRequestException('Main category ID is required');
        }
        return this.service.getFirstCategoryByMainCategoryId(mainCategoryId);
    }

    @Public()
    @Get('second-categories')
    @Header('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    async getSecondCategories(@Query('firstCategoryId') firstCategoryId: string) {
        if (!firstCategoryId) {
            throw new BadRequestException('First category ID is required');
        }
        return this.service.getSecondCategoryByFirstCategoryId(firstCategoryId);
    }

    @Public()
    @Get('/common-data')
    @Header('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    async getCommonData() {
        return await this.service.getCommonData();
    }

    @Public()
    @Get('/home-page')
    @Header('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    async getHomePageData() {
        return await this.service.getHomePageData();
    }

    @Public()
    @Get('/cart-page')
    @Header('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    async getCartPageData() {
        return await this.service.getCartPageData();
    }

    @Public()
    @Get('/shop-page')
    @Header('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    async getShopPageData() {
        return await this.service.getShopPageData();
    }

    @Public()
    @Get('/product-list-with-hard-limit')
    @Header('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    async findProductListWithHardLimit(@Query() dto: ProductFilterDto) {
        return await this.service.findProductListWithHardLimit(dto);
    }

    @Public()
    @Get('/product')
    @Header('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
	async findProductList(@Query() dto: ProductFilterDto) {
		return await this.service.findProductList(dto);
	}

    @Public()
    @Get('/product/:slug')
    @Header('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    async findSingleProduct(@Param('slug') slug: string) {
        return await this.service.findSingleProduct(slug);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
    @Get('/admin-dashboard')
    async findAdminDashboardData() {
        return await this.service.findAdminDashboardData();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.VENDOR)
    @Get('/vendor-dashboard')
    async findVendorDashboardData(@Req() req: Request) {
        return await this.service.findVendorDashboardData(req?.user);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('/vendor')
    async findVendorList(@Query() dto: UserFilterDto) {
        return await this.service.findVendorList(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('/admin')
    async findAdminList(@Query() dto: UserFilterDto) {
        return await this.service.findAdminList(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('/customer')
    async findCustomerList(@Query() dto: UserFilterDto) {
        return await this.service.findCustomerList(dto);
    }
}
