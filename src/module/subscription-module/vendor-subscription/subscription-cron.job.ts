import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { VendorSubscriptionService } from './vendor-subscription.service';

@Injectable()
export class SubscriptionCronJob {
    constructor(private readonly service: VendorSubscriptionService) { }

    // @Cron('*/30 * * * *')
    // async handleSubscriptionRenewals() {
    //     await this.service.expireEndedSubscriptions();
    //     console.log('Expired ended subscriptions automatically.');
    // }
}