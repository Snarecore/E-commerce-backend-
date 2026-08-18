import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from 'express';
import { CONFIG } from "src/utils/config";
import { VendorDashboardService } from "./vendor-dashboard.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { RolesGuard } from "src/guards/role.guard";
import { Roles } from "src/decorators/role.decorator";
import { Role } from "src/enums/role.enum";

@Controller({
    path: 'vendor',
    version: CONFIG.API_VERSION
})
export class VendorDashboardController {
    constructor(private readonly service: VendorDashboardService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('sales-dashboard')
    async getVendorSalesDashboardData(@Req() req: Request) {
        return this.service.getVendorSalesDashboardData(req?.user);
    }
}