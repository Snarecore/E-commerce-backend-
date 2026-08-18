import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OrderSummaryRepository } from 'src/module/order-summary/order-summary.repository';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { VendorPaymentRequestRepository } from './vendor-payment-request.repository';
import { CreatePaymentRequestDto } from './dto/vendor-payment-request.dto';
import { VendorPaymentRequestFilterDto } from './dto/vendor-payment-request-filter.dto';
import { FindOptionsOrder } from 'typeorm';
import { VendorPaymentRequest } from './entity/vendor-payment-request.entity';
import { UpdatePaymentRequestStatusDto } from './dto/update-payment-request.dto';
import { SpaceService } from 'src/module/space-module/space-service/space.service';
import * as PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import { UserProfileRepository } from 'src/module/user-profile/user-profile.repository';

@Injectable()
export class VendorPaymentRequestService {
    constructor(
        private readonly orderSummaryRepository: OrderSummaryRepository,
        private readonly vendorPaymentRequestRepository: VendorPaymentRequestRepository,
        private readonly spaceService: SpaceService,
        private readonly userProfileRepository: UserProfileRepository
    ) { }

    private async generateInvoicePdf(request: VendorPaymentRequest): Promise<Buffer> {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => { });

        doc.fontSize(20).text('Vendor Payment Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Invoice ID: ${request.id}`);
        doc.text(`Vendor Name: ${request.vendor?.name ?? '-'}`);
        doc.text(`Vendor Email: ${request.vendor?.email ?? '-'}`);
        doc.text(`Vendor Phone: ${request.vendor?.phone ?? '-'}`);
        doc.text(`Amount: $${request.amount}`);
        doc.text(`Date: ${new Date().toDateString()}`);
        doc.text(`Payment Ref: ${request.paymentRef || '-'}`);
        doc.text(`Gateway: ${request.gateway || '-'}`);
        doc.end();

        return new Promise(resolve => {
            doc.on('end', () => {
                const finalBuffer = Buffer.concat(buffers);
                resolve(finalBuffer);
            });
        });
    }

    async getVendorBalance(vendorId: string): Promise<number> {
        const totalEarnings = await this.orderSummaryRepository.getTotalEarningsForVendor(vendorId);
        const totalCommission = await this.orderSummaryRepository.getTotalCommissionForVendor(vendorId);
        const totalPaid = await this.vendorPaymentRequestRepository.getTotalPaidToVendor(vendorId);

        return totalEarnings - totalCommission - totalPaid;
    }

    async createPaymentRequest(vendorData: any, dto: CreatePaymentRequestDto) {
        const vendorId = vendorData.id;
        const balance = await this.getVendorBalance(vendorId);

        if (dto.amount > balance) {
            throw new BadRequestException('Requested amount exceeds available balance.');
        }

        const request = await this.vendorPaymentRequestRepository.create({
            vendorId,
            amount: dto.amount,
            status: 'PENDING'
        });

        return ResponseUtils.successResponseHandler(201, 'Request submitted.', 'data', request);
    }

    async listVendorRequests(dto: VendorPaymentRequestFilterDto) {
        const order: FindOptionsOrder<VendorPaymentRequest> = {
            createdAt: 'DESC'
        };

        const query: any = {};
        const { vendorId } = dto;
        if (vendorId) query.vendorId = vendorId;

        const result = await this.vendorPaymentRequestRepository.paginate({
            page: dto.page ? dto?.page : 1,
            limit: dto.limit ? dto?.limit : 10,
            query,
            order
        });

        const enrichedData = await Promise.all(
            result.data.map(async (request) => {
                const profile = await this.userProfileRepository.findOneByQuery({
                    user: { id: request.vendorId }
                });

                return {
                    ...request,
                    vendorProfile: profile ?? null
                };
            })
        );

        const payload = {
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
            pageCount: result.pageCount
        };

        return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
    }

    async updateRequestStatus(id: string, dto: UpdatePaymentRequestStatusDto) {
        const request = await this.vendorPaymentRequestRepository.findOneByQueryRelation(
            { id: id as any },
            { relations: ['vendor'] }
        );
        if (!request) {
            throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
        }

        request.status = dto.status;
        request.paymentRef = dto.paymentRef ?? '';
        request.gateway = dto.gateway ?? '';

        if (dto.status === 'APPROVED') {
            request.approvedAt = new Date();
        }

        if (dto.status === 'PAID') {
            request.paidAt = new Date();

            const invoiceBuffer = await this.generateInvoicePdf(request);

            const invoiceUrl = await this.spaceService.uploadBufferFile(invoiceBuffer, 'invoices', 'pdf');

            request.invoiceUrl = invoiceUrl || '';
        }

        const updated = await this.vendorPaymentRequestRepository.save(request);

        return ResponseUtils.successResponseHandler(200, 'Payment request updated', 'data', updated);
    }

    async getVendorStatisticsData(vendorData: any) {
        const vendorId = vendorData.id;
        const [
            statistics,
            totalWithdrawnAmount,
            lastPaidWithdrawal
        ] = await Promise.all([
            this.orderSummaryRepository.getVendorSalesStatistics(vendorId),
            this.vendorPaymentRequestRepository.getTotalPaidToVendor(vendorId),
            this.vendorPaymentRequestRepository.getLastPaidWithdrawal(vendorId)
        ]);

        const payload = {
            totalNetProfit: statistics.totalSalesAmount - statistics.totalCommissionPaid,
            totalWithdrawnAmount: totalWithdrawnAmount,
            lastPaidWithdrawal: lastPaidWithdrawal
        };

        return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
    }
}

