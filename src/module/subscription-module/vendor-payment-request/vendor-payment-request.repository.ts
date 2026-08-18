import { Injectable } from '@nestjs/common';
import { AbstractRepository } from 'src/database/abstract.repository';
import { DataSource } from 'typeorm';
import { VendorPaymentRequest } from './entity/vendor-payment-request.entity';

@Injectable()
export class VendorPaymentRequestRepository extends AbstractRepository<VendorPaymentRequest> {
    constructor(dataSource: DataSource) {
        super(dataSource, VendorPaymentRequest);
    }

    async getTotalPaidToVendor(vendorId: string): Promise<number> {
        const { paid = 0 } = await this.repository
            .createQueryBuilder('req')
            .select('SUM(req.amount)', 'paid')
            .where('req.vendorId = :vendorId AND req.status = :status', { vendorId, status: 'PAID' })
            .getRawOne();

        return Number(paid);
    }

    async getLastPaidWithdrawal(vendorId: string): Promise<VendorPaymentRequest | null> {
        return await this.repository.findOne({
            where: {
                vendorId,
                status: 'PAID',
                isDeleted: false
            },
            order: {
                paidAt: 'DESC'
            }
        });
    }
}
