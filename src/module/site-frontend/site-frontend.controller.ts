import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { SiteFrontendService } from './site-frontend.service';
import { ProductFilterDto } from '../inventory/product/dto/product-filter.dto';
import { Public } from 'src/decorators/public.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Request } from 'express';
import { UserFilterDto } from '../user/dto/user-filter.dto';
import { BlogFilterDto } from '../blog/dto/blog-filter.dto';

@Controller({
    path: 'site',
    version: CONFIG.API_VERSION
})
export class SiteFrontendController {
    constructor(private readonly service: SiteFrontendService) { }
    
    @Public()
    @Get('/main-category')
    async getMainCategoryData() {
        return await this.service.getMainCategoryData();
    }

    @Public()
    @Get('first-categories')
    async getFirstCategories(@Query('mainCategoryId') mainCategoryId: string) {
        if (!mainCategoryId) {
            throw new BadRequestException('Main category ID is required');
        }
        return this.service.getFirstCategoryByMainCategoryId(mainCategoryId);
    }

    @Public()
    @Get('second-categories')
    async getSecondCategories(@Query('firstCategoryId') firstCategoryId: string) {
        if (!firstCategoryId) {
            throw new BadRequestException('First category ID is required');
        }
        return this.service.getSecondCategoryByFirstCategoryId(firstCategoryId);
    }

    @Public()
    @Get('third-categories')
    async getThirdCategories(@Query('secondCategoryId') secondCategoryId: string) {
        if (!secondCategoryId) {
            throw new BadRequestException('Second category ID is required');
        }
        return this.service.getThirdCategoryBySecondCategoryId(secondCategoryId);
    }

    @Public()
    @Get('/common-data')
    async getCommonData() {
        return await this.service.getCommonData();
    }

    @Public()
    @Get('/home-page')
    async getHomePageData() {
        return await this.service.getHomePageData();
    }

    @Public()
    @Get('/cart-page')
    async getCartPageData() {
        return await this.service.getCartPageData();
    }

    @Public()
    @Get('/shop-page')
    async getShopPageData() {
        return await this.service.getShopPageData();
    }

    @Public()
    @Get('/product-list-with-hard-limit')
    async findProductListWithHardLimit(@Query() dto: ProductFilterDto) {
        return await this.service.findProductListWithHardLimit(dto);
    }

    @Public()
    @Get('/product')
	async findProductList(@Query() dto: ProductFilterDto) {
		return await this.service.findProductList(dto);
	}

    @Public()
    @Get('/product/:slug')
    async findSingleProduct(@Param('slug') slug: string) {
        return await this.service.findSingleProduct(slug);
    }

    @Public()
    @Get('/blog')
	async findBlogList(@Query() dto: BlogFilterDto) {
		return await this.service.findBlogList(dto);
	}

    @Public()
    @Get('/blog/:slug')
    async findSingleBlog(@Param('slug') slug: string) {
        return await this.service.findSingleBlog(slug);
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
