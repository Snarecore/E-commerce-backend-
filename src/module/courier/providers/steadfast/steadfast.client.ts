import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
    ConsignmentResult,
    CourierError,
    CourierProviderClient,
    CreateConsignmentInput,
    StatusResult
} from '../courier-provider.interface';
import { CourierProvider, ShipmentStatus } from '../../enums/shipment-status.enum';
import { mapSteadfastStatus } from './steadfast-status.mapper';

const DEFAULT_BASE_URL = 'https://portal.packzy.com/api/v1';
const DEFAULT_TRACKING_URL_TEMPLATE = 'https://steadfast.com.bd/t/{tracking_code}';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * The only place that talks HTTP to Steadfast.
 *
 * Contract notes (verify against the merchant API docs before going live):
 * - Auth headers: Api-Key / Secret-Key
 * - POST /create_order -> { status: 200, consignment: { consignment_id, tracking_code, status, ... } }
 * - GET /status_by_cid/{id}, /status_by_invoice/{invoice} -> { status: 200, delivery_status }
 * - Validation failures may come back as HTTP 200 with a non-200 body "status".
 */
@Injectable()
export class SteadfastClient implements CourierProviderClient {
    readonly provider = CourierProvider.STEADFAST;
    private readonly logger = new Logger(SteadfastClient.name);
    private http: AxiosInstance | null = null;

    constructor(private readonly config: ConfigService) {}

    isEnabled(): boolean {
        const enabled = String(this.config.get('STEADFAST_ENABLED') ?? 'false').toLowerCase() === 'true';
        return enabled && !!this.apiKey() && !!this.secretKey();
    }

    async createConsignment(input: CreateConsignmentInput): Promise<ConsignmentResult> {
        const body = {
            invoice: input.invoice,
            recipient_name: input.recipientName,
            recipient_phone: input.recipientPhone,
            recipient_address: input.recipientAddress,
            cod_amount: input.codAmount,
            note: input.note || undefined
        };

        const data = await this.request('post', '/create_order', body);
        const consignment = data?.consignment;
        if (Number(data?.status) !== 200 || !consignment?.consignment_id) {
            throw this.classifyBodyError(data);
        }

        return {
            consignmentId: String(consignment.consignment_id),
            trackingCode: consignment.tracking_code ? String(consignment.tracking_code) : null,
            providerStatus: consignment.status ? String(consignment.status) : null
        };
    }

    async getStatusByConsignmentId(consignmentId: string): Promise<StatusResult> {
        const data = await this.request('get', `/status_by_cid/${encodeURIComponent(consignmentId)}`);
        if (Number(data?.status) !== 200 || !data?.delivery_status) {
            throw this.classifyBodyError(data);
        }
        return { providerStatus: String(data.delivery_status) };
    }

    async findStatusByInvoice(invoice: string): Promise<StatusResult | null> {
        try {
            const data = await this.request('get', `/status_by_invoice/${encodeURIComponent(invoice)}`);
            if (Number(data?.status) === 200 && data?.delivery_status) {
                return { providerStatus: String(data.delivery_status) };
            }
            return null;
        } catch (err) {
            // "Not found" is the expected answer when the earlier create never reached Steadfast.
            if (err instanceof CourierError && (err.kind === 'REJECTED' || err.httpStatus === 404)) {
                return null;
            }
            throw err;
        }
    }

    mapStatus(providerStatus: string | null | undefined): ShipmentStatus {
        return mapSteadfastStatus(providerStatus);
    }

    buildTrackingUrl(trackingCode: string | null): string | null {
        if (!trackingCode) return null;
        const template = this.config.get<string>('STEADFAST_TRACKING_URL_TEMPLATE') || DEFAULT_TRACKING_URL_TEMPLATE;
        return template.replace('{tracking_code}', encodeURIComponent(trackingCode));
    }

    private apiKey(): string {
        return (this.config.get<string>('STEADFAST_API_KEY') || '').trim();
    }

    private secretKey(): string {
        return (this.config.get<string>('STEADFAST_SECRET_KEY') || '').trim();
    }

    private client(): AxiosInstance {
        if (!this.http) {
            this.http = axios.create({
                baseURL: (this.config.get<string>('STEADFAST_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, ''),
                timeout: REQUEST_TIMEOUT_MS,
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
            });
        }
        return this.http;
    }

    private async request(method: 'get' | 'post', path: string, body?: unknown): Promise<any> {
        if (!this.isEnabled()) {
            throw new CourierError('CONFIG', 'Steadfast integration is disabled or credentials are missing.');
        }
        const headers = { 'Api-Key': this.apiKey(), 'Secret-Key': this.secretKey() };
        try {
            const res = method === 'get'
                ? await this.client().get(path, { headers })
                : await this.client().post(path, body, { headers });
            return res.data;
        } catch (error) {
            throw this.classifyHttpError(error, path);
        }
    }

    private classifyHttpError(error: unknown, path: string): CourierError {
        const err = error as AxiosError<any>;
        const status = err.response?.status;
        // Never log request config: it carries the API keys.
        this.logger.warn(`[Steadfast] ${path} failed: ${status ?? err.code ?? 'network'} ${err.message}`);

        if (!err.response) return new CourierError('TRANSIENT', `Network error: ${err.code || err.message}`);
        if (status === 401 || status === 403) {
            const rawMsg = typeof err.response.data === 'string' ? err.response.data.trim() : err.response.data?.message;
            const detail = rawMsg ? `: ${rawMsg}` : '';
            return new CourierError('CONFIG', `Steadfast rejected the API credentials${detail}`, status);
        }
        if (status === 429 || (status !== undefined && status >= 500)) {
            return new CourierError('TRANSIENT', `Steadfast unavailable (HTTP ${status}).`, status);
        }
        return this.classifyBodyError(err.response.data, status);
    }

    private classifyBodyError(data: any, httpStatus?: number): CourierError {
        const messages: string[] = [];
        if (data?.message) messages.push(String(data.message));
        if (data?.errors && typeof data.errors === 'object') {
            for (const value of Object.values(data.errors)) {
                messages.push(...(Array.isArray(value) ? value.map(String) : [String(value)]));
            }
        }
        const text = (messages.join('; ') || 'Unexpected response from Steadfast.').slice(0, 1000);
        const lower = text.toLowerCase();
        if (lower.includes('invoice') && /(taken|already|exist|duplicate|unique)/.test(lower)) {
            return new CourierError('DUPLICATE', text, httpStatus);
        }
        return new CourierError('REJECTED', text, httpStatus);
    }
}
