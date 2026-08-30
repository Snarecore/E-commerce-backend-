import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { Public } from '../../decorators/public.decorator';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller({ path: 'coupons', version: CONFIG.API_VERSION })
export class CouponController {
    constructor(private readonly couponService: CouponService) {}

    @Public()
    @Post('validate')
    async validateCoupon(@Body() dto: ValidateCouponDto, @Request() req: any) {
        const userId = req.user?.id || req.user?.userId || '';
        return this.couponService.calculateCouponPreview(dto, userId);
    }

    @Post()
    async create(@Body() dto: CreateCouponDto) {
        return this.couponService.create(dto);
    }

    @Get()
    async findAll(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('search') search?: string
    ) {
        return this.couponService.findAll(Number(page), Number(limit), search);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.couponService.findOne(id);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.couponService.update(id, dto);
    }

    @Delete(':id')
    async softDelete(@Param('id') id: string) {
        return this.couponService.softDelete(id);
    }
}
