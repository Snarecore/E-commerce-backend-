import {
    Controller,
    Get,
    UseGuards,
    Req,
    Body,
    Post,
    Query,
    Patch,
    Param
} from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Request } from 'express';
import { CreatePaymentRequestDto } from './dto/vendor-payment-request.dto';
import { VendorPaymentRequestService } from './vendor-payment-request.service';
import { VendorPaymentRequestFilterDto } from './dto/vendor-payment-request-filter.dto';
import { UpdatePaymentRequestStatusDto } from './dto/update-payment-request.dto';

@Controller({ path: 'vendor-payment-request', version: CONFIG.API_VERSION })
export class VendorPaymentRequestController {
    constructor(private readonly service: VendorPaymentRequestService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Post()
    async requestPayment(@Req() req: Request, @Body() dto: CreatePaymentRequestDto) {
        const vendorData = req?.user;
        return this.service.createPaymentRequest(vendorData, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR, Role.ADMIN)
    @Get('payment-history')
    async getPaymentHistory(@Query() dto: VendorPaymentRequestFilterDto) {
        return this.service.listVendorRequests(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('statistics')
    async getVendorStatisticsData(@Req() req: Request) {
        const vendorData = req?.user;
        return this.service.getVendorStatisticsData(vendorData);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdatePaymentRequestStatusDto
    ) {
        return this.service.updateRequestStatus(id, dto);
    }

}
