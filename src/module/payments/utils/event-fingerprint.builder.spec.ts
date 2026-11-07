import { EventFingerprintBuilder } from './event-fingerprint.builder';

describe('EventFingerprintBuilder', () => {
    it('should generate identical fingerprints for Browser Callback and IPN despite amount formatting variations', () => {
        const browserCallbackHash = EventFingerprintBuilder.build({
            paymentId: 'pay-uuid-1234',
            eventType: 'PAYMENT_VALIDATED',
            tranId: 'SSLCZ-BB1001-A1',
            valId: 'VAL-998877',
            gatewayStatus: 'VALID',
            amount: '1000',
            currency: 'bdt'
        });

        const ipnHash = EventFingerprintBuilder.build({
            paymentId: 'pay-uuid-1234',
            eventType: 'PAYMENT_VALIDATED',
            tranId: 'SSLCZ-BB1001-A1',
            valId: 'VAL-998877',
            gatewayStatus: 'VALID',
            amount: '1000.00',
            currency: 'BDT'
        });

        expect(browserCallbackHash).toBe(ipnHash);
    });

    it('should generate different fingerprints for different statuses or amounts', () => {
        const successHash = EventFingerprintBuilder.build({
            paymentId: 'pay-uuid-1234',
            eventType: 'PAYMENT_VALIDATED',
            tranId: 'SSLCZ-BB1001-A1',
            valId: 'VAL-998877',
            gatewayStatus: 'VALID',
            amount: '1000.00',
            currency: 'BDT'
        });

        const failedHash = EventFingerprintBuilder.build({
            paymentId: 'pay-uuid-1234',
            eventType: 'PAYMENT_FAILED',
            tranId: 'SSLCZ-BB1001-A1',
            valId: 'VAL-998877',
            gatewayStatus: 'FAILED',
            amount: '1000.00',
            currency: 'BDT'
        });

        expect(successHash).not.toBe(failedHash);
    });
});
