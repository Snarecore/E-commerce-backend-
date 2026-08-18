import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { OrderSummaryRepository } from "../order-summary/order-summary.repository";
import { ResponseUtils } from "src/utils/response.utils";
import { VendorSubscriptionRepository } from "../subscription-module/vendor-subscription/vendor-subscription.repository";
import { IsNull } from "typeorm";
import { ProductRepository } from "../inventory/product/product.repository";
import { VendorPaymentRequestRepository } from "../subscription-module/vendor-payment-request/vendor-payment-request.repository";

@Injectable()
export class VendorDashboardService {
    constructor(
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly vendorSubscriptionRepository: VendorSubscriptionRepository,
        private readonly productRepository: ProductRepository,
        private readonly vendorPaymentRequestRepository: VendorPaymentRequestRepository
    ) { }

    async getVendorSalesDashboardData(vendorData: any) {
        try {
            const vendorId = vendorData?.id;
            const [
                statistics,
                subscriptionData,
                topCategories,
                categoryStatistics,
                topSellingProducts,
                monthlySalesCommissionData,
                totalWithdrawnAmount
            ] = await Promise.all([
                this.orderSummaryRepository.getVendorSalesStatistics(vendorId),
                this.vendorSubscriptionRepository.findOneByQueryRelation(
                    {
                        vendorId,
                        endDate: IsNull()
                    },
                    {
                        relations: ['tier']
                    }
                ),
                this.orderSummaryRepository.getTopCategoriesByVendor(vendorId),
                this.productRepository.getVendorCategoryAndProductStatistics(vendorId),
                this.orderSummaryRepository.getTopSellingProductsByVendor(vendorId),
                this.orderSummaryRepository.getVendorMonthlySalesAndCommission(vendorId),
                this.vendorPaymentRequestRepository.getTotalPaidToVendor(vendorId)
            ]);

            const payload = {
                totalOrders: statistics.totalOrders,
                totalSalesAmount: statistics.totalSalesAmount,
                totalCommissionPaid: statistics.totalCommissionPaid,
                totalNetProfit: statistics.totalSalesAmount - statistics.totalCommissionPaid,
                subscriptionData: subscriptionData,
                topCategories: topCategories,
                categoryStatistics: categoryStatistics,
                topSellingProducts: topSellingProducts,
                monthlySalesCommissionData: monthlySalesCommissionData,
                totalWithdrawnAmount: totalWithdrawnAmount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error) {
            throw new InternalServerErrorException('Failed to load dashboard data.');
        }
    }
}