import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentRequestBody } from './types/payment-request-body';

@Injectable()
export class PaymentsService {
	private stripe: Stripe;

	constructor() {
		this.stripe = new Stripe(process.env.API_SECRET_KEY as string, {
            apiVersion: '2025-04-30.basil'
        });
	}  

	async createPayment(paymentRequestBody: PaymentRequestBody) {
		let amount = 0;
		paymentRequestBody.products.forEach((product) => {
			amount = amount + product.price * product.quantity;
		});
		const paymentIntent = await this.stripe.paymentIntents.create({
			amount: amount * 100,
			currency: paymentRequestBody.currency
		});
		return { clientSecret: paymentIntent.client_secret };
	}
}
