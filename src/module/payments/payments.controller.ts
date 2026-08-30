import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../decorators/public.decorator';
import { CONFIG } from '../../utils/config';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PaymentsService } from './payments.service';

interface RequestWithRawBody extends Request {
    rawBody?: Buffer;
}

@Controller({ path: 'payments', version: CONFIG.API_VERSION })
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Public()
    @Post()
    async createPayment(
        @Body() body: any
    ): Promise<{ clientSecret: string }> {
        return this.paymentsService.createPayment(body);
    }

    @Public()
    @Post('create-checkout-session')
    async createCheckoutSession(
        @Body() dto: CreateCheckoutSessionDto
    ): Promise<{ url: string; sessionId: string; orderId: string }> {
        return this.paymentsService.createCheckoutSession(dto);
    }

    @Public()
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Req() req: RequestWithRawBody,
        @Headers('stripe-signature') signature: string
    ): Promise<{ received: boolean }> {
        if (!signature) {
            throw new BadRequestException('Missing stripe-signature header');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException(
                'Raw body missing. Ensure NestFactory rawBody: true is enabled.'
            );
        }

        return this.paymentsService.handleWebhookEvent(rawBody, signature);
    }
}
