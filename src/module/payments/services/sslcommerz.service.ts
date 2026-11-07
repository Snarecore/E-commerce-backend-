import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SslcommerzInitParams {
    tranId: string;
    amount: string;
    currency: string;
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    customerAddress: string;
    customerCity: string;
    orderId: string;
    successUrl: string;
    failUrl: string;
    cancelUrl: string;
    ipnUrl: string;
}

export interface SslcommerzValidationResponse {
    status: string;
    tran_date?: string;
    tran_id?: string;
    val_id?: string;
    amount?: string;
    store_amount?: string;
    currency?: string;
    bank_tran_id?: string;
    card_type?: string;
    card_no?: string;
    card_issuer?: string;
    card_brand?: string;
    card_issuer_country?: string;
    card_issuer_country_code?: string;
    currency_type?: string;
    currency_amount?: string;
    risk_level?: string;
    risk_title?: string;
    error?: string;
}

export interface SslcommerzQueryResponse {
    APIConnect?: string;
    status?: string;
    element?: Array<{
        val_id?: string;
        tran_id?: string;
        amount?: string;
        bank_tran_id?: string;
        card_type?: string;
        status?: string;
        tran_date?: string;
        currency?: string;
        card_issuer?: string;
        card_brand?: string;
        card_no?: string;
        risk_level?: string;
    }>;
}

export interface SslcommerzRefundResponse {
    APIConnect?: string;
    bank_tran_id?: string;
    trans_id?: string;
    refund_ref_id?: string;
    status?: string;
    errorReason?: string;
}

export interface SslcommerzRefundQueryResponse {
    APIConnect?: string;
    refund_ref_id?: string;
    trans_id?: string;
    bank_tran_id?: string;
    refund_amount?: string;
    status?: string;
    errorReason?: string;
}

@Injectable()
export class SslcommerzService {
    private readonly logger = new Logger(SslcommerzService.name);
    private readonly storeId: string;
    private readonly storePassword: string;
    private readonly isLive: boolean;
    private readonly sessionUrl: string;
    private readonly validationUrl: string;
    private readonly queryUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.storeId =
            this.configService.get<string>('SSLCOMMERZ_STORE_ID') ||
            process.env.SSLCOMMERZ_STORE_ID ||
            'testbox';
        this.storePassword =
            this.configService.get<string>('SSLCOMMERZ_STORE_PASSWORD') ||
            process.env.SSLCOMMERZ_STORE_PASSWORD ||
            'qwerty';
        this.isLive =
            (this.configService.get<string>('SSLCOMMERZ_IS_LIVE') || process.env.SSLCOMMERZ_IS_LIVE) === 'true';

        if (this.isLive) {
            this.sessionUrl = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
            this.validationUrl = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';
            this.queryUrl = 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
        } else {
            this.sessionUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
            this.validationUrl = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
            this.queryUrl = 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
        }

        this.logger.log(`SSLCommerz initialized in [${this.isLive ? 'LIVE' : 'SANDBOX'}] mode with storeId: "${this.storeId}"`);
    }

    getStoreId(): string {
        return this.storeId;
    }

    getIsLive(): boolean {
        return this.isLive;
    }

    /**
     * Initiates a payment session with SSLCommerz gateway.
     */
    async initiatePaymentSession(params: SslcommerzInitParams): Promise<{
        status: string;
        gatewayPageUrl?: string;
        sessionKey?: string;
        failedReason?: string;
    }> {
        const formData = new URLSearchParams();
        formData.append('store_id', this.storeId);
        formData.append('store_passwd', this.storePassword);
        formData.append('total_amount', params.amount);
        formData.append('currency', params.currency || 'BDT');
        formData.append('tran_id', params.tranId);
        formData.append('success_url', params.successUrl);
        formData.append('fail_url', params.failUrl);
        formData.append('cancel_url', params.cancelUrl);
        formData.append('ipn_url', params.ipnUrl);

        // Customer details
        formData.append('cus_name', params.customerName || 'Customer');
        formData.append('cus_email', params.customerEmail || 'customer@bazaarbound.com');
        formData.append('cus_add1', params.customerAddress || 'Dhaka, Bangladesh');
        formData.append('cus_city', params.customerCity || 'Dhaka');
        formData.append('cus_country', 'Bangladesh');
        formData.append('cus_phone', params.customerPhone || '01700000000');

        // Product details
        formData.append('shipping_method', 'NO');
        formData.append('product_name', `Order-${params.orderId}`);
        formData.append('product_category', 'Fashion');
        formData.append('product_profile', 'general');

        try {
            const response = await axios.post(this.sessionUrl, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });

            const data = response.data;
            if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
                return {
                    status: 'SUCCESS',
                    gatewayPageUrl: data.GatewayPageURL,
                    sessionKey: data.sessionkey
                };
            }

            this.logger.warn(`SSLCommerz Session Init failed: ${data?.failedreason || JSON.stringify(data)}`);
            return {
                status: 'FAILED',
                failedReason: data?.failedreason || 'Gateway rejected initiation'
            };
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            this.logger.error(`SSLCommerz Network Timeout/Error during session init: ${errorMsg}`);
            throw new Error(`SSLCommerz Initiation Error: ${errorMsg}`);
        }
    }

    /**
     * Server-to-Server Order Validation API call.
     * Strictly verifies val_id against SSLCommerz servers.
     */
    async validateTransaction(valId: string): Promise<SslcommerzValidationResponse> {
        try {
            const response = await axios.get(this.validationUrl, {
                params: {
                    val_id: valId,
                    store_id: this.storeId,
                    store_passwd: this.storePassword,
                    format: 'json'
                },
                timeout: 10000
            });

            return response.data as SslcommerzValidationResponse;
        } catch (error: any) {
            this.logger.error(`SSLCommerz Server-to-Server Validation Network Error: ${error?.message}`);
            throw error;
        }
    }

    /**
     * Query Transaction Status by our tran_id (used for reconciliation & verification).
     */
    async queryTransaction(tranId: string): Promise<SslcommerzQueryResponse> {
        try {
            const response = await axios.get(this.queryUrl, {
                params: {
                    tran_id: tranId,
                    store_id: this.storeId,
                    store_passwd: this.storePassword,
                    format: 'json'
                },
                timeout: 10000
            });

            return response.data as SslcommerzQueryResponse;
        } catch (error: any) {
            this.logger.error(`SSLCommerz Query API Network Error: ${error?.message}`);
            throw error;
        }
    }

    /**
     * Initiates a refund request with SSLCommerz gateway.
     */
    async initiateRefund(params: {
        bankTranId: string;
        refundAmount: string;
        refundRemarks: string;
        refundRefId: string;
    }): Promise<SslcommerzRefundResponse> {
        try {
            const response = await axios.get(this.queryUrl, {
                params: {
                    bank_tran_id: params.bankTranId,
                    refund_amount: params.refundAmount,
                    refund_remarks: params.refundRemarks,
                    refe_id: params.refundRefId,
                    store_id: this.storeId,
                    store_passwd: this.storePassword,
                    format: 'json'
                },
                timeout: 10000
            });

            return response.data as SslcommerzRefundResponse;
        } catch (error: any) {
            this.logger.error(`SSLCommerz Refund Initiation Network Timeout/Error: ${error?.message}`);
            throw error;
        }
    }

    /**
     * Queries refund status by refund_ref_id with SSLCommerz gateway.
     */
    async queryRefund(refundRefId: string): Promise<SslcommerzRefundQueryResponse> {
        try {
            const response = await axios.get(this.queryUrl, {
                params: {
                    refund_ref_id: refundRefId,
                    store_id: this.storeId,
                    store_passwd: this.storePassword,
                    format: 'json'
                },
                timeout: 10000
            });

            return response.data as SslcommerzRefundQueryResponse;
        } catch (error: any) {
            this.logger.error(`SSLCommerz Refund Query API Network Error: ${error?.message}`);
            throw error;
        }
    }
}
