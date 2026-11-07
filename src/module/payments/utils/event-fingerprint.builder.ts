import * as crypto from 'crypto';
import { CurrencyUtils } from '../../../utils/currency.utils';

export class EventFingerprintBuilder {
    /**
     * Builds a cross-source deterministic event fingerprint.
     * Normalizes amount to stringified integer Paisa to avoid "1000" vs "1000.00" mismatches.
     * Uses immutable primary gateway identifier (valId or tranId), normalized gateway status, and paisa.
     * Source (BROWSER_CALLBACK vs IPN) is excluded from the hash to ensure identical fingerprints across channels.
     */
    static build(params: {
        paymentId: string;
        eventType: string;
        tranId: string;
        valId?: string | null;
        gatewayStatus: string;
        amount: string;
        currency: string;
    }): string {
        const canonicalPaisa = CurrencyUtils.toPaisa(params.amount).toString();
        const normalizedStatus = (params.gatewayStatus || '').trim().toUpperCase();
        const primaryIdentifier = (params.valId || params.tranId || '').trim();

        // Deterministic sorted serialization contract
        const canonicalString = [
            `currency=${params.currency.trim().toUpperCase()}`,
            `eventType=${params.eventType.trim()}`,
            `gatewayStatus=${normalizedStatus}`,
            `identifier=${primaryIdentifier}`,
            `paisa=${canonicalPaisa}`,
            `paymentId=${params.paymentId.trim()}`
        ].join('&');

        return crypto
            .createHash('sha256')
            .update(canonicalString)
            .digest('hex');
    }
}
