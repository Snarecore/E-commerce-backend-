import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Request,
    UseGuards
} from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { VendorSubscriptionService } from './vendor-subscription.service';
import { AssignTierRequest, SubscriptionPaymentRequest } from './interface/payment-request';
import { VendorSubscriptionFilterDto } from './dto/vendor-subscription-filter.dto';

@Controller({ path: 'vendor/subscription', version: CONFIG.API_VERSION })
export class VendorSubscriptionController {
    constructor(
        private readonly service: VendorSubscriptionService
    ) { }

    @Post('payment-intent')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    async generatePaymentIntent(
        @Request() req,
        @Body() body: SubscriptionPaymentRequest
    ) {
        const vendorId = req.user.id;
        return this.service.createSubscriptionPaymentIntent(vendorId, body.tierId, body.currency);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('tiers')
    async availableTiers() {
        return await this.service.findAllTiers();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Post('select')
    async subscribe(@Request() req, @Body() body: AssignTierRequest) {
        const vendorId = req.user.id;
        return await this.service.assignTierToVendor(vendorId, body.tierId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('active')
    async activeSubscription(@Request() req) {
        const vendorId = req.user.id;
        return await this.service.isActiveTier(vendorId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('all')
    async listVendorSubscriptions(@Query() dto: VendorSubscriptionFilterDto) {
        return this.service.listVendorSubscriptions(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR, Role.ADMIN)
    @Get('single/:id')
    async findOne(@Param('id') id: string) {
        return await this.service.findOne(id);
    }
}
