import { ShipmentStatus } from '../enums/shipment-status.enum';

export interface CreateConsignmentInput {
    invoice: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    codAmount: number;
    note?: string | null;
}

export interface ConsignmentResult {
    consignmentId: string;
    trackingCode: string | null;
    providerStatus: string | null;
}

export interface StatusResult {
    providerStatus: string;
}

/**
 * Error classes the dispatch worker relies on:
 * - REJECTED: the courier refused the request (validation, bad data). Retrying won't help.
 * - DUPLICATE: the invoice already exists at the courier. Needs manual linking.
 * - TRANSIENT: network, timeout, 5xx, 429. Outcome unknown; safe to retry after an invoice lookup.
 * - CONFIG: credentials missing/invalid. Retrying won't help until config is fixed.
 */
export type CourierErrorKind = 'REJECTED' | 'DUPLICATE' | 'TRANSIENT' | 'CONFIG';

export class CourierError extends Error {
    constructor(
        public readonly kind: CourierErrorKind,
        message: string,
        public readonly httpStatus?: number
    ) {
        super(message);
        this.name = 'CourierError';
    }
}

/** Kept deliberately thin: only what one provider needs today. */
export interface CourierProviderClient {
    readonly provider: string;
    isEnabled(): boolean;
    createConsignment(input: CreateConsignmentInput): Promise<ConsignmentResult>;
    getStatusByConsignmentId(consignmentId: string): Promise<StatusResult>;
    /** Returns null when the courier has no consignment for this invoice. */
    findStatusByInvoice(invoice: string): Promise<StatusResult | null>;
    mapStatus(providerStatus: string | null | undefined): ShipmentStatus;
    buildTrackingUrl(trackingCode: string | null): string | null;
}
