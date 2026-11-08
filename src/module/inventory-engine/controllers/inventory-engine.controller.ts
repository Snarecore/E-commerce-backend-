import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CONFIG } from '../../../utils/config';
import { ResponseUtils, ApiResponse } from '../../../utils/response.utils';
import { InventoryEngineService } from '../services/inventory-engine.service';
import { QueryStockMovementsDto, AdjustStockParams, QueryLowStockAlertsDto } from '../dto/stock-movement.dto';
import { CreateAdjustmentDto, QueryAdjustmentsDto } from '../dto/stock-adjustment.dto';
import { ProcessReturnDto } from '../dto/stock-return.dto';
import { ExecuteExchangeDto } from '../dto/stock-exchange.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { Request } from 'express';

@Controller({ path: 'inventory', version: CONFIG.API_VERSION })
export class InventoryEngineController {
    constructor(private readonly inventoryService: InventoryEngineService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('movements')
    async getMovements(@Query() query: QueryStockMovementsDto): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getMovements(query);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock movements fetched successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('availability/:productId')
    async getAvailability(
        @Param('productId') productId: string,
        @Query('size') size?: string
    ): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getAvailability(productId, size);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock availability fetched successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('adjust-single')
    async adjustSingleStock(
        @Body() body: AdjustStockParams,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const performedBy = user?.id || user?.userId || 'ADMIN';
        const performedByName = user?.name || user?.email || 'Admin User';

        const result = await this.inventoryService.adjustStock({
            ...body,
            performedBy,
            performedByName
        });

        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock adjusted and ledger recorded successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('adjustments')
    async getAdjustments(@Query() query: QueryAdjustmentsDto): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getAdjustments(query);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock adjustments fetched successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('adjustments/:id')
    async getAdjustmentById(@Param('id') id: string): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getAdjustmentById(id);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock adjustment fetched successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('adjustments')
    async createAdjustment(
        @Body() body: CreateAdjustmentDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const result = await this.inventoryService.createAdjustment(body, user);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_201,
            'Stock adjustment created successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('adjustments/:id/approve')
    async approveAdjustment(
        @Param('id') id: string,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const result = await this.inventoryService.approveAdjustment(id, user);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock adjustment approved and stock updated successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('adjustments/:id/reject')
    async rejectAdjustment(
        @Param('id') id: string,
        @Body('reason') reason: string,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const result = await this.inventoryService.rejectAdjustment(id, user, reason);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Stock adjustment rejected successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('returns/process')
    async processOrderReturn(
        @Body() body: ProcessReturnDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const result = await this.inventoryService.processOrderReturn(body, user);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Order return processed with inspection and stock updated successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('exchanges/execute')
    async executeOrderExchange(
        @Body() body: ExecuteExchangeDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const user = (req as any).user;
        const result = await this.inventoryService.executeOrderExchange(body, user);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Order exchange executed and stock updated successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('analytics/summary')
    async getInventoryAnalytics(): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getInventoryAnalyticsSummary();
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Inventory analytics summary fetched successfully',
            'data',
            result
        );
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get('alerts/low-stock')
    async getLowStockAlerts(
        @Query() query: QueryLowStockAlertsDto
    ): Promise<ApiResponse<any>> {
        const result = await this.inventoryService.getLowStockAlerts(query);
        return ResponseUtils.successResponseHandler(
            CONFIG.HTTP_200,
            'Low stock alerts fetched successfully',
            'data',
            result
        );
    }
}
