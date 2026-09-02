import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProfitReportFilterDto } from './dto/profit-report-filter.dto';
import { ProfitReportStatusScope, CostSource } from '../../enums/profit-report.enum';
import { ResponseUtils } from '../../utils/response.utils';

@Injectable()
export class ProfitReportService implements OnModuleInit {
    constructor(private readonly dataSource: DataSource) {}

    async onModuleInit() {
        // Auto-add columns to MySQL table if missing
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`unitCostPrice\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
        } catch (e) {}
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`totalCost\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
        } catch (e) {}
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`costSource\` enum('SNAPSHOT','MIGRATED','UNKNOWN') NOT NULL DEFAULT 'SNAPSHOT'`);
        } catch (e) {}
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`snapshotMainCategoryId\` varchar(255) NULL`);
        } catch (e) {}
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`snapshotFirstCategoryId\` varchar(255) NULL`);
        } catch (e) {}
        try {
            await this.dataSource.query(`ALTER TABLE \`order-summary\` ADD COLUMN \`snapshotSecondCategoryId\` varchar(255) NULL`);
        } catch (e) {}

        // Auto-backfill existing order summaries and missing createdAt
        try {
            await this.dataSource.query(`UPDATE orders SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL;`);
        } catch (e) {}

        try {
            await this.dataSource.query(`
                UPDATE \`order-summary\` os
                LEFT JOIN \`product\` p ON os.productId = p.id
                SET 
                    os.unitCostPrice = IF(p.cost IS NOT NULL AND p.cost > 0, p.cost, 0.00),
                    os.totalCost = IF(p.cost IS NOT NULL AND p.cost > 0, ROUND(p.cost * os.quantity, 2), 0.00),
                    os.costSource = IF(p.cost IS NOT NULL AND p.cost > 0, 'MIGRATED', 'UNKNOWN'),
                    os.snapshotMainCategoryId = p.mainCategoryId,
                    os.snapshotFirstCategoryId = p.firstCategoryId,
                    os.snapshotSecondCategoryId = p.secondCategoryId
                WHERE os.unitCostPrice = 0.00 AND os.costSource = 'SNAPSHOT';
            `);
        } catch (e) {}

        try {
            await this.dataSource.query(`CREATE INDEX \`IDX_order_summary_costSource\` ON \`order-summary\` (\`costSource\`);`);
        } catch (e) {}
        try {
            await this.dataSource.query(`CREATE INDEX \`IDX_order_summary_categories\` ON \`order-summary\` (\`snapshotMainCategoryId\`, \`snapshotFirstCategoryId\`);`);
        } catch (e) {}
        try {
            await this.dataSource.query(`CREATE INDEX \`IDX_orders_status_created\` ON \`orders\` (\`status\`, \`createdAt\`);`);
        } catch (e) {}
    }

    private buildStatusCondition(scope?: ProfitReportStatusScope, customStatus?: string): { sql: string; params: any[] } {
        if (scope === ProfitReportStatusScope.ACTIVE_ALL) {
            return {
                sql: `o.status NOT IN ('Cancelled', 'Rejected', 'Failed') AND (o.isDeleted = 0 OR o.isDeleted IS NULL)`,
                params: []
            };
        } else if (scope === ProfitReportStatusScope.CUSTOM && customStatus) {
            return {
                sql: `o.status = ? AND (o.isDeleted = 0 OR o.isDeleted IS NULL)`,
                params: [customStatus]
            };
        } else {
            // Default: DELIVERED_COMPLETED
            return {
                sql: `o.status IN ('Delivered', 'Completed') AND (o.isDeleted = 0 OR o.isDeleted IS NULL)`,
                params: []
            };
        }
    }

    private buildDateCondition(startDate?: string, endDate?: string): { sql: string; params: any[] } {
        const clauses: string[] = [];
        const params: any[] = [];

        if (startDate) {
            clauses.push(`o.createdAt >= ?`);
            params.push(startDate.includes('T') ? startDate : `${startDate} 00:00:00`);
        }
        if (endDate) {
            clauses.push(`o.createdAt <= ?`);
            params.push(endDate.includes('T') ? endDate : `${endDate} 23:59:59`);
        }

        return {
            sql: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
            params
        };
    }

    async getSummary(dto: ProfitReportFilterDto) {
        try {
            const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
            const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);
            const categoryCond = dto.mainCategoryId ? `os.snapshotMainCategoryId = ?` : `1=1`;

            const whereParams = [...statusCond.params, ...dateCond.params];
            if (dto.mainCategoryId) whereParams.push(dto.mainCategoryId);

            const orderStatsQuery = dto.mainCategoryId ? `
                SELECT 
                    COUNT(o.id) as totalOrders,
                    COALESCE(SUM(o.subtotal), 0) as subtotalRevenue,
                    COALESCE(SUM(o.discountAmount), 0) as couponDiscount,
                    COALESCE(SUM(o.deliveryCharge), 0) as deliveryCollected
                FROM orders o
                WHERE o.id IN (
                    SELECT DISTINCT os.orderId FROM \`order-summary\` os WHERE os.snapshotMainCategoryId = ?
                ) AND ${statusCond.sql} AND ${dateCond.sql}
            ` : `
                SELECT 
                    COUNT(o.id) as totalOrders,
                    COALESCE(SUM(o.subtotal), 0) as subtotalRevenue,
                    COALESCE(SUM(o.discountAmount), 0) as couponDiscount,
                    COALESCE(SUM(o.deliveryCharge), 0) as deliveryCollected
                FROM orders o
                WHERE ${statusCond.sql} AND ${dateCond.sql}
            `;

            const summaryStatsQuery = dto.mainCategoryId ? `
                SELECT 
                    COALESCE(SUM(os.price * os.quantity), 0) as grossSales,
                    COALESCE(SUM(os.totalCost), 0) as totalCogs,
                    SUM(CASE WHEN os.costSource = 'UNKNOWN' OR os.unitCostPrice = 0 THEN 1 ELSE 0 END) as unknownCostItemCount
                FROM orders o
                JOIN \`order-summary\` os ON os.orderId = o.id
                WHERE ${statusCond.sql} AND ${dateCond.sql} AND ${categoryCond}
            ` : `
                SELECT 
                    COALESCE(SUM(os.price * os.quantity), 0) as grossSales,
                    COALESCE(SUM(os.totalCost), 0) as totalCogs,
                    SUM(CASE WHEN os.costSource = 'UNKNOWN' OR os.unitCostPrice = 0 THEN 1 ELSE 0 END) as unknownCostItemCount
                FROM orders o
                JOIN \`order-summary\` os ON os.orderId = o.id
                WHERE ${statusCond.sql} AND ${dateCond.sql}
            `;

            const [orderRes, summaryRes] = await Promise.all([
                this.dataSource.query(orderStatsQuery, whereParams),
                this.dataSource.query(summaryStatsQuery, whereParams)
            ]);

            const orderRow = orderRes[0] || {};
            const summaryRow = summaryRes[0] || {};

            const subtotalRevenue = Number(orderRow.subtotalRevenue || 0);
            const couponDiscount = Number(orderRow.couponDiscount || 0);
            const grossSales = Number(summaryRow.grossSales || 0);
            const productDiscount = Math.max(0, grossSales - subtotalRevenue);

            const netRevenue = Math.max(0, subtotalRevenue - couponDiscount);
            const cogs = Number(summaryRow.totalCogs || 0);
            const grossProfit = netRevenue - cogs;

            const deliveryCollected = Number(orderRow.deliveryCollected || 0);
            const courierCost = 0.00; // Not tracked in DB
            const netProfit = grossProfit + (deliveryCollected - courierCost);

            const grossMargin = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(2)) : 0;
            const netMargin = netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(2)) : 0;

            const totalOrders = Number(orderRow.totalOrders || 0);
            const averageNetProfitPerOrder = totalOrders > 0 ? Number((netProfit / totalOrders).toFixed(2)) : 0;
            const unknownCostItemCount = Number(summaryRow.unknownCostItemCount || 0);

            const data = {
                grossSales: Number(grossSales.toFixed(2)),
                productDiscount: Number(productDiscount.toFixed(2)),
                couponDiscount: Number(couponDiscount.toFixed(2)),
                netRevenue: Number(netRevenue.toFixed(2)),
                cogs: Number(cogs.toFixed(2)),
                grossProfit: Number(grossProfit.toFixed(2)),
                deliveryCollected: Number(deliveryCollected.toFixed(2)),
                courierCost: Number(courierCost.toFixed(2)),
                isCourierCostTracked: false,
                netProfit: Number(netProfit.toFixed(2)),
                grossMargin,
                netMargin,
                deliveredOrders: totalOrders,
                averageNetProfitPerOrder,
                unknownCostItemCount
            };

            return ResponseUtils.successResponseHandler(200, 'Profit summary retrieved successfully.', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(error.message || 'Failed to calculate profit summary.');
        }
    }

    async getTrend(dto: ProfitReportFilterDto) {
        try {
            const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
            const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);

            let dateFormat = '%Y-%m-%d';
            if (dto.period === 'weekly') dateFormat = '%Y-%u';
            else if (dto.period === 'monthly') dateFormat = '%Y-%m';
            else if (dto.period === 'yearly') dateFormat = '%Y';

            const orderTrendQuery = `
                SELECT 
                    DATE_FORMAT(o.createdAt, '${dateFormat}') as dateGroup,
                    MIN(DATE(o.createdAt)) as displayDate,
                    COUNT(o.id) as ordersCount,
                    COALESCE(SUM(o.subtotal - o.discountAmount), 0) as netRevenue,
                    COALESCE(SUM(o.deliveryCharge), 0) as deliveryCollected
                FROM orders o
                WHERE ${statusCond.sql} AND ${dateCond.sql}
                GROUP BY dateGroup
                ORDER BY dateGroup ASC
            `;

            const cogsTrendQuery = `
                SELECT 
                    DATE_FORMAT(o.createdAt, '${dateFormat}') as dateGroup,
                    COALESCE(SUM(os.totalCost), 0) as cogs
                FROM orders o
                JOIN \`order-summary\` os ON os.orderId = o.id
                WHERE ${statusCond.sql} AND ${dateCond.sql}
                GROUP BY dateGroup
            `;

            const params = [...statusCond.params, ...dateCond.params];
            const [orderRows, cogsRows] = await Promise.all([
                this.dataSource.query(orderTrendQuery, params),
                this.dataSource.query(cogsTrendQuery, params)
            ]);

            const cogsMap = new Map<string, number>();
            for (const r of cogsRows) {
                cogsMap.set(r.dateGroup, Number(r.cogs || 0));
            }

            const data = orderRows.map((r: any) => {
                const netRevenue = Number(r.netRevenue || 0);
                const cogs = cogsMap.get(r.dateGroup) || 0;
                const deliveryCollected = Number(r.deliveryCollected || 0);
                const grossProfit = netRevenue - cogs;
                const netProfit = grossProfit + deliveryCollected;

                return {
                    date: r.displayDate ? new Date(r.displayDate).toISOString().split('T')[0] : r.dateGroup,
                    ordersCount: Number(r.ordersCount || 0),
                    netRevenue: Number(netRevenue.toFixed(2)),
                    cogs: Number(cogs.toFixed(2)),
                    grossProfit: Number(grossProfit.toFixed(2)),
                    netProfit: Number(netProfit.toFixed(2))
                };
            });

            return ResponseUtils.successResponseHandler(200, 'Profit trend retrieved successfully.', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(error.message || 'Failed to fetch profit trend.');
        }
    }

    async getProducts(dto: ProfitReportFilterDto) {
        try {
            const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
            const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);

            const query = `
                SELECT 
                    os.productId,
                    os.productName,
                    os.productImage,
                    COALESCE(SUM(os.quantity), 0) as quantitySold,
                    COALESCE(SUM(os.price * os.quantity), 0) as grossItemRevenue,
                    COALESCE(SUM(os.totalCost), 0) as totalCogs,
                    MIN(os.unitCostPrice) as minUnitCost,
                    MAX(os.unitCostPrice) as maxUnitCost,
                    MAX(os.costSource) as costSource,
                    COALESCE(SUM(
                        CASE WHEN o.subtotal > 0 THEN 
                            (os.price * os.quantity / o.subtotal) * o.discountAmount 
                        ELSE 0 END
                    ), 0) as allocatedCouponDiscount
                FROM orders o
                JOIN \`order-summary\` os ON os.orderId = o.id
                WHERE ${statusCond.sql} AND ${dateCond.sql}
                GROUP BY os.productId, os.productName, os.productImage
            `;

            const rows = await this.dataSource.query(query, [...statusCond.params, ...dateCond.params]);

            const mapped = rows.map((r: any) => {
                const quantitySold = Number(r.quantitySold || 0);
                const grossItemRevenue = Number(r.grossItemRevenue || 0);
                const couponDiscount = Number(r.allocatedCouponDiscount || 0);
                const netRevenue = Math.max(0, grossItemRevenue - couponDiscount);
                const cogs = Number(r.totalCogs || 0);
                const grossProfit = netRevenue - cogs;
                const realizedUnitPrice = quantitySold > 0 ? Number((netRevenue / quantitySold).toFixed(2)) : 0;
                const isCostVerified = r.costSource !== CostSource.UNKNOWN && Number(r.maxUnitCost || 0) > 0;
                const grossMargin = (isCostVerified && netRevenue > 0)
                    ? Number(((grossProfit / netRevenue) * 100).toFixed(2))
                    : null;

                return {
                    productId: r.productId,
                    productName: r.productName,
                    productImage: r.productImage,
                    quantitySold,
                    grossItemRevenue: Number(grossItemRevenue.toFixed(2)),
                    netRevenue: Number(netRevenue.toFixed(2)),
                    cogs: Number(cogs.toFixed(2)),
                    grossProfit: Number(grossProfit.toFixed(2)),
                    realizedUnitPrice,
                    grossMargin,
                    costSource: r.costSource || CostSource.UNKNOWN,
                    isCostVerified,
                    unitCostPrice: Number(r.maxUnitCost || 0)
                };
            });

            // Filter according to tab
            let filtered = mapped;
            if (dto.productTab === 'most_profitable') {
                filtered = mapped.filter((p: any) => p.isCostVerified && p.grossProfit > 0)
                    .sort((a: any, b: any) => b.grossProfit - a.grossProfit);
            } else if (dto.productTab === 'low_margin') {
                filtered = mapped.filter((p: any) => p.isCostVerified && p.grossMargin !== null && p.grossMargin < 20)
                    .sort((a: any, b: any) => (a.grossMargin ?? 0) - (b.grossMargin ?? 0));
            } else if (dto.productTab === 'loss_making') {
                filtered = mapped.filter((p: any) => p.isCostVerified && p.grossProfit < 0)
                    .sort((a: any, b: any) => a.grossProfit - b.grossProfit);
            } else if (dto.productTab === 'unverified_cost') {
                filtered = mapped.filter((p: any) => !p.isCostVerified);
            }

            const page = dto.page || 1;
            const limit = dto.limit || 10;
            const total = filtered.length;
            const paginated = filtered.slice((page - 1) * limit, page * limit);

            return ResponseUtils.successResponseHandler(200, 'Product profitability retrieved successfully.', 'data', {
                data: paginated,
                total,
                page,
                limit
            });
        } catch (error) {
            throw new InternalServerErrorException(error.message || 'Failed to fetch product profitability.');
        }
    }

    async getCategories(dto: ProfitReportFilterDto) {
        try {
            const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
            const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);

            const query = `
                SELECT 
                    os.snapshotMainCategoryId as mainCategoryId,
                    COALESCE(mc.name, 'Unknown / Unassigned Category') as categoryName,
                    COUNT(DISTINCT o.id) as ordersCount,
                    COALESCE(SUM(os.quantity), 0) as quantitySold,
                    COALESCE(SUM(os.price * os.quantity), 0) as grossRevenue,
                    COALESCE(SUM(os.totalCost), 0) as cogs
                FROM orders o
                JOIN \`order-summary\` os ON os.orderId = o.id
                LEFT JOIN \`main-category\` mc ON mc.id = os.snapshotMainCategoryId
                WHERE ${statusCond.sql} AND ${dateCond.sql}
                GROUP BY os.snapshotMainCategoryId, mc.name
                ORDER BY grossRevenue DESC
            `;

            const rows = await this.dataSource.query(query, [...statusCond.params, ...dateCond.params]);

            const data = rows.map((r: any) => {
                const netRevenue = Number(Number(r.grossRevenue || 0).toFixed(2));
                const cogs = Number(Number(r.cogs || 0).toFixed(2));
                const grossProfit = Number((netRevenue - cogs).toFixed(2));
                const grossMargin = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(2)) : 0;

                return {
                    mainCategoryId: r.mainCategoryId,
                    categoryName: r.categoryName,
                    ordersCount: Number(r.ordersCount || 0),
                    quantitySold: Number(r.quantitySold || 0),
                    netRevenue,
                    cogs,
                    grossProfit,
                    grossMargin
                };
            });

            return ResponseUtils.successResponseHandler(200, 'Category profitability retrieved successfully.', 'data', data);
        } catch (error) {
            throw new InternalServerErrorException(error.message || 'Failed to fetch category profitability.');
        }
    }

    async getOrders(dto: ProfitReportFilterDto) {
        try {
            const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
            const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);

            const page = dto.page || 1;
            const limit = dto.limit || 10;
            const offset = (page - 1) * limit;

            const countQuery = `
                SELECT COUNT(DISTINCT o.id) as total
                FROM orders o
                WHERE ${statusCond.sql} AND ${dateCond.sql}
            `;
            const countRes = await this.dataSource.query(countQuery, [...statusCond.params, ...dateCond.params]);
            const total = Number(countRes[0]?.total || 0);

            const query = `
                SELECT 
                    o.id,
                    o.orderId,
                    o.createdAt,
                    o.status,
                    o.subtotal,
                    o.discountAmount as couponDiscount,
                    o.deliveryCharge,
                    u.name as customerName,
                    COALESCE(SUM(os.totalCost), 0) as orderCogs,
                    SUM(CASE WHEN os.costSource = 'UNKNOWN' THEN 1 ELSE 0 END) as unknownItemCount
                FROM orders o
                LEFT JOIN \`user\` u ON u.id = o.userId
                LEFT JOIN \`order-summary\` os ON os.orderId = o.id
                WHERE ${statusCond.sql} AND ${dateCond.sql}
                GROUP BY o.id, o.orderId, o.createdAt, o.status, o.subtotal, o.discountAmount, o.deliveryCharge, u.name
                ORDER BY o.createdAt DESC
                LIMIT ? OFFSET ?
            `;

            const params = [...statusCond.params, ...dateCond.params, limit, offset];
            const rows = await this.dataSource.query(query, params);

            const data = rows.map((r: any) => {
                const subtotal = Number(r.subtotal || 0);
                const couponDiscount = Number(r.couponDiscount || 0);
                const netRevenue = Math.max(0, subtotal - couponDiscount);
                const cogs = Number(r.orderCogs || 0);
                const grossProfit = netRevenue - cogs;
                const deliveryCharge = Number(r.deliveryCharge || 0);
                const netProfit = grossProfit + deliveryCharge;
                const netMargin = netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(2)) : 0;

                return {
                    id: r.id,
                    orderId: r.orderId,
                    createdAt: r.createdAt,
                    status: r.status,
                    customerName: r.customerName || 'Guest Customer',
                    subtotal: Number(subtotal.toFixed(2)),
                    couponDiscount: Number(couponDiscount.toFixed(2)),
                    netRevenue: Number(netRevenue.toFixed(2)),
                    cogs: Number(cogs.toFixed(2)),
                    grossProfit: Number(grossProfit.toFixed(2)),
                    deliveryCharge: Number(deliveryCharge.toFixed(2)),
                    netProfit: Number(netProfit.toFixed(2)),
                    netMargin,
                    hasUnknownCostItems: Number(r.unknownItemCount || 0) > 0
                };
            });

            return ResponseUtils.successResponseHandler(200, 'Order profit list retrieved successfully.', 'data', {
                data,
                total,
                page,
                limit
            });
        } catch (error) {
            throw new InternalServerErrorException(error.message || 'Failed to fetch order profit list.');
        }
    }

    async generateCsvContent(dto: ProfitReportFilterDto): Promise<string> {
        const statusCond = this.buildStatusCondition(dto.statusScope, dto.customStatus);
        const dateCond = this.buildDateCondition(dto.startDate, dto.endDate);

        const query = `
            SELECT 
                o.orderId,
                o.createdAt,
                o.status,
                COALESCE(u.name, 'Guest') as customerName,
                o.subtotal,
                o.discountAmount as couponDiscount,
                COALESCE(SUM(os.totalCost), 0) as orderCogs,
                o.deliveryCharge
            FROM orders o
            LEFT JOIN \`user\` u ON u.id = o.userId
            LEFT JOIN \`order-summary\` os ON os.orderId = o.id
            WHERE ${statusCond.sql} AND ${dateCond.sql}
            GROUP BY o.id, o.orderId, o.createdAt, o.status, u.name, o.subtotal, o.discountAmount, o.deliveryCharge
            ORDER BY o.createdAt DESC
        `;

        const rows = await this.dataSource.query(query, [...statusCond.params, ...dateCond.params]);

        let csv = 'Order ID,Date,Status,Customer,Subtotal (BDT),Coupon Discount (BDT),Net Revenue (BDT),COGS (BDT),Gross Profit (BDT),Delivery Charge (BDT),Net Profit (BDT),Net Margin %\n';

        for (const r of rows) {
            const subtotal = Number(r.subtotal || 0);
            const couponDiscount = Number(r.couponDiscount || 0);
            const netRevenue = Math.max(0, subtotal - couponDiscount);
            const cogs = Number(r.orderCogs || 0);
            const grossProfit = netRevenue - cogs;
            const deliveryCharge = Number(r.deliveryCharge || 0);
            const netProfit = grossProfit + deliveryCharge;
            const netMargin = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : '0.00';
            const dateStr = new Date(r.createdAt).toISOString().split('T')[0];

            csv += `"${r.orderId}","${dateStr}","${r.status}","${r.customerName}",${subtotal.toFixed(2)},${couponDiscount.toFixed(2)},${netRevenue.toFixed(2)},${cogs.toFixed(2)},${grossProfit.toFixed(2)},${deliveryCharge.toFixed(2)},${netProfit.toFixed(2)},${netMargin}%\n`;
        }

        return csv;
    }
}
