import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { ProfitReportService } from './profit-report.service';
import { ProfitReportFilterDto } from './dto/profit-report-filter.dto';
import { CONFIG } from '../../utils/config';

@Controller({ path: 'reports/profit', version: CONFIG.API_VERSION })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProfitReportController {
    constructor(private readonly profitReportService: ProfitReportService) {}

    @Get('/summary')
    async getSummary(@Query() filterDto: ProfitReportFilterDto) {
        return await this.profitReportService.getSummary(filterDto);
    }

    @Get('/trend')
    async getTrend(@Query() filterDto: ProfitReportFilterDto) {
        return await this.profitReportService.getTrend(filterDto);
    }

    @Get('/products')
    async getProducts(@Query() filterDto: ProfitReportFilterDto) {
        return await this.profitReportService.getProducts(filterDto);
    }

    @Get('/categories')
    async getCategories(@Query() filterDto: ProfitReportFilterDto) {
        return await this.profitReportService.getCategories(filterDto);
    }

    @Get('/orders')
    async getOrders(@Query() filterDto: ProfitReportFilterDto) {
        return await this.profitReportService.getOrders(filterDto);
    }

    @Get('/export')
    async exportCsv(@Query() filterDto: ProfitReportFilterDto, @Res() res: Response) {
        const csvContent = await this.profitReportService.generateCsvContent(filterDto);
        const fileName = `bazaarbound_profit_report_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(csvContent);
    }
}
