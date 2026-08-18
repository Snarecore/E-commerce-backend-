import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ResponseUtils, ApiResponse } from 'src/utils/response.utils';
import { SubscriptionTierRepository } from '../subscription-tier/subscription-tier.repository';
import { VendorSubscriptionRepository } from './vendor-subscription.repository';
import { FindOptionsOrder, IsNull } from 'typeorm';
import { VendorSubscription } from './entity/vendor-subscription.entity';
import Stripe from 'stripe';
import { VendorSubscriptionFilterDto } from './dto/vendor-subscription-filter.dto';

@Injectable()
export class VendorSubscriptionService {
    private stripe: Stripe;

    constructor(
        private readonly vendorSubscriptionRepository: VendorSubscriptionRepository,
        private readonly subscriptionTierRepository: SubscriptionTierRepository
    ) {
        this.stripe = new Stripe(process.env.API_SECRET_KEY as string, {
            apiVersion: '2025-04-30.basil'
        });
    }

    async createSubscriptionPaymentIntent(vendorId: string, tierId: string, currency: string) {
        const tier = await this.subscriptionTierRepository.findOne(tierId);
        if (!tier) throw new HttpException('Tier not found', HttpStatus.BAD_REQUEST);

        const amount = tier.price * 100;

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount,
            currency,
            metadata: {
                vendorId,
                tierId
            }
        });

        return { clientSecret: paymentIntent.client_secret };
    }

    async findAllTiers() {
        try {
            const result = await this.subscriptionTierRepository.findAll();
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', result);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getActiveTierByVendor(vendorId: string) {
        return this.vendorSubscriptionRepository.findOneByQueryRelation(
            {
                vendorId,
                endDate: IsNull()
            },
            {
                relations: ['tier']
            }
        );
    }

    async assignTierToVendor(vendorId: string, tierId: string) {
        const active = await this.getActiveTierByVendor(vendorId);

        if (active && active.tierId === tierId) {
            throw new HttpException('You are already subscribed to this tier.', HttpStatus.BAD_REQUEST);
        }

        if (active) {
            active.endDate = new Date();
            await this.vendorSubscriptionRepository.save(active);
        }

        return this.vendorSubscriptionRepository.create({
            vendorId,
            tierId,
            startDate: new Date()
        });
    }

    async isActiveTier(vendorId: string) {
        const result = await this.vendorSubscriptionRepository.findOneByQueryRelation(
            {
                vendorId,
                endDate: IsNull()
            },
            {
                relations: ['tier']
            }
        );

        return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', result);
    }

    async expireEndedSubscriptions(): Promise<void> {
        const now = new Date();

        const subscriptions = await this.vendorSubscriptionRepository.findAllWithOrder(
            {
                endDate: IsNull()
            },
            {
                startDate: 'ASC'
            }
        );

        const expired: VendorSubscription[] = [];

        for (const record of subscriptions) {
            const expectedEnd = new Date(record.startDate);
            expectedEnd.setMonth(expectedEnd.getMonth() + record.tier.durationInMonths);

            if (expectedEnd < now) {
                record.endDate = now;
                expired.push(record);
            }
        }

        if (expired.length > 0) {
            await this.vendorSubscriptionRepository.save(expired);
        }
    }

    async listVendorSubscriptions(dto: VendorSubscriptionFilterDto) {
        try {
            const order: FindOptionsOrder<VendorSubscription> = {
                startDate: 'desc'
            };

            const query: any = {};

            const { vendorId, tierId } = dto;

            if (vendorId) query.vendorId = vendorId;
            if (tierId) query.tierId = tierId;

            const result = await this.vendorSubscriptionRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order,
                relations: ['vendor', 'tier']
            });

            const payload = {
                data: result?.data,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Vendor subscriptions fetched successfully.', 'data', payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findOne(id: string) {
        try {
            const data = await this.vendorSubscriptionRepository.findOneWithRelations(id, ['vendor', 'tier']);
            if (!data) {
                throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
            }
            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', data);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
