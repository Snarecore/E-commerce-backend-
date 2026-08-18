import { Body, Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { PaymentRequestBody } from './types/payment-request-body';
import { CONFIG } from 'src/utils/config';
import { Public } from 'src/decorators/public.decorator';
import Stripe from 'stripe';
import { VendorSubscriptionService } from '../subscription-module/vendor-subscription/vendor-subscription.service';

@Controller({ path: "payments", version: CONFIG.API_VERSION })
export class PaymentsController {
	private stripe: Stripe;

	constructor(
		private paymentService: PaymentsService,
		private vendorSubscriptionService: VendorSubscriptionService
	) { 
		this.stripe = new Stripe(process.env.API_SECRET_KEY as string, {
            apiVersion: '2025-04-30.basil'
        });
	}

	@Public()
	@Post()
	async createPayment(@Body() body: PaymentRequestBody) {
		return await this.paymentService.createPayment(body);
	}

	// @Post('webhook')
	// @Public()
	// async handleStripeWebhook(@Req() request: Request, @Res() res: Response) {
	// 	const stripeSignature = request.headers['stripe-signature'] as string;

	// 	let event;
	// 	try {
	// 		event = this.stripe.webhooks.constructEvent(
	// 			request.body,
	// 			stripeSignature,
	// 			process.env.STRIPE_WEBHOOK_SECRET!
	// 		);
	// 	} catch (err) {
	// 		return res.status(400).send(`Webhook Error: ${err.message}`);
	// 	}

	// 	if (event.type === 'payment_intent.succeeded') {
	// 		const intent = event.data.object as Stripe.PaymentIntent;
	// 		const vendorId = intent.metadata.vendorId;
	// 		const tierId = intent.metadata.tierId;

	// 		await this.vendorSubscriptionService.assignTierToVendor(vendorId, tierId);
	// 	}

	// 	res.json({ received: true });
	// }
}
