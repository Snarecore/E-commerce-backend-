import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CONFIG } from '../../utils/config';
import { Public } from '../../decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { IncompleteCheckoutService } from './incomplete-checkout.service';
import { TrackCheckoutDto } from './dto/track-checkout.dto';
import { IncompleteCheckoutFilterDto } from './dto/incomplete-checkout-filter.dto';
import { CreateRecoveryActivityDto } from './dto/create-recovery-activity.dto';
import { UpdateCheckoutStatusDto } from './dto/update-checkout-status.dto';

@Controller({ path: 'incomplete-checkouts', version: CONFIG.API_VERSION })
export class IncompleteCheckoutController {
    constructor(private readonly service: IncompleteCheckoutService) {}

    /**
     * Public Storefront Tracking Endpoint
     * Debounced calls capture customer input and cart changes without requiring login.
     */
    @Public()
    @UseGuards(OptionalJwtAuthGuard)
    @Post('track')
    async track(@Body() dto: TrackCheckoutDto, @Req() req: Request) {
        const customerId = (req.user as any)?.id || null;
        return await this.service.trackCheckout(dto, customerId);
    }

    /**
     * Admin Dashboard KPI Statistics
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('stats')
    async getStats(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
        return await this.service.getAdminStats(fromDate, toDate);
    }

    /**
     * Admin Paginated List with Search, Status, and Date Filters
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async getList(@Query() filter: IncompleteCheckoutFilterDto) {
        return await this.service.getAdminList(filter);
    }

    /**
     * Admin Details View with Recovery History
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get(':id')
    async getDetails(@Param('id') id: string) {
        return await this.service.getCheckoutDetails(id);
    }

    /**
     * Admin Record Recovery Action (Call, WhatsApp, Note)
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post(':id/activity')
    async logActivity(
        @Param('id') id: string,
        @Body() dto: CreateRecoveryActivityDto,
        @Req() req: Request
    ) {
        const adminId = (req.user as any)?.id;
        return await this.service.logActivity(id, adminId, dto);
    }

    /**
     * Admin Manual Status Update (Cancel, etc.)
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateCheckoutStatusDto,
        @Req() req: Request
    ) {
        const adminId = (req.user as any)?.id;
        return await this.service.updateStatus(id, adminId, dto);
    }

    /**
     * Admin Convert to Official Order
     */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post(':id/convert-to-order')
    async convertToOrder(@Param('id') id: string, @Req() req: Request) {
        const adminId = (req.user as any)?.id;
        return await this.service.convertToOrder(id, adminId);
    }
}
