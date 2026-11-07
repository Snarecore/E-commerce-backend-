import { GatewaySanitizer } from '../utils/gateway-sanitizer.util';

describe('GatewaySanitizer & Audit Metadata Security (Allowlist + Defensive Engine)', () => {
    // =========================================================================
    // 1. Layer 1: Stripe Allowlist Extraction
    // =========================================================================
    describe('Stripe Allowlist Extraction', () => {
        it('should extract only safe allowlisted fields and drop all raw SDK internals', () => {
            const rawStripeIntent: any = {
                id: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
                object: 'payment_intent',
                amount: 1099,
                currency: 'usd',
                status: 'succeeded',
                client_secret: 'pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_test_123',
                customer: 'cus_12345678',
                charges: {
                    object: 'list',
                    data: [
                        {
                            id: 'ch_123',
                            payment_method_details: {
                                card: {
                                    brand: 'visa',
                                    fingerprint: '12345',
                                    cvc_check: 'pass',
                                },
                            },
                        },
                    ],
                },
                payment_method_types: ['card', 'link'],
                canceled_at: null,
                cancellation_reason: null,
                created: 1679000000,
                livemode: false,
            };

            const extracted = GatewaySanitizer.extractStripeAuditMetadata(rawStripeIntent);

            expect(extracted).toEqual({
                gateway: 'STRIPE',
                intentId: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
                status: 'succeeded',
                amount: 1099,
                currency: 'USD',
                paymentMethodTypes: ['card', 'link'],
                created: new Date(1679000000 * 1000).toISOString(),
            });

            // Ensure no raw charges, secrets, or internal customer IDs are present
            expect(extracted.client_secret).toBeUndefined();
            expect(extracted.charges).toBeUndefined();
            expect(extracted.customer).toBeUndefined();
        });

        it('should validate invalid fields and drop unallowlisted statuses and corrupted amounts', () => {
            const corruptedIntent: any = {
                id: 'not_a_valid_pi_id',
                amount: -500, // Negative amount
                currency: 'US_DOLLARS', // Invalid currency length
                status: 'HACKED_STATUS', // Unallowlisted status
                canceled_at: 'invalid_date',
            };

            const extracted = GatewaySanitizer.extractStripeAuditMetadata(corruptedIntent);

            expect(extracted.gateway).toBe('STRIPE');
            expect(extracted.intentId).toBeUndefined();
            expect(extracted.amount).toBeUndefined();
            expect(extracted.currency).toBeUndefined();
            expect(extracted.status).toBeUndefined();
            expect(extracted.canceledAt).toBeUndefined();
        });
    });

    // =========================================================================
    // 2. Layer 1: SSLCommerz Allowlist Extraction
    // =========================================================================
    describe('SSLCommerz Allowlist Extraction', () => {
        it('should extract allowlisted fields from standard element array response', () => {
            const rawSslczResponse: any = {
                status: 'OK',
                APIConnect: 'DONE',
                element: [
                    {
                        tran_id: 'SSLCZ-ORD-1001',
                        val_id: 'VAL-SSLCZ-999',
                        status: 'VALID',
                        amount: '1500.50',
                        currency: 'bdt',
                        bank_tran_id: 'BANK-TRX-123',
                        card_type: 'VISA-DBBL',
                        card_brand: 'VISA',
                        card_issuer: 'DBBL',
                        risk_level: '0',
                        tran_date: '2026-11-07 14:00:00',
                        sessionkey: 'SECRET_SESSION_KEY_DO_NOT_STORE',
                        gw_version: 'v4',
                    },
                ],
            };

            const extracted = GatewaySanitizer.extractSslcommerzAuditMetadata(rawSslczResponse);

            expect(extracted).toEqual({
                gateway: 'SSLCOMMERZ',
                tranId: 'SSLCZ-ORD-1001',
                valId: 'VAL-SSLCZ-999',
                status: 'VALID',
                amount: '1500.50',
                currency: 'BDT',
                bankTranId: 'BANK-TRX-123',
                cardType: 'VISA-DBBL',
                cardBrand: 'VISA',
                cardIssuer: 'DBBL',
                riskLevel: '0',
                tranDate: '2026-11-07 14:00:00',
            });

            expect(extracted.sessionkey).toBeUndefined();
            expect(extracted.gw_version).toBeUndefined();
        });

        it('should not introduce undocumented defaults when optional fields are omitted', () => {
            const partialResponse: any = {
                tran_id: 'SSLCZ-ORD-2002',
                status: 'VALIDATED',
                amount: 500,
                currency: 'BDT',
                // risk_level, bank_tran_id, card_type are omitted
            };

            const extracted = GatewaySanitizer.extractSslcommerzAuditMetadata(partialResponse);

            expect(extracted.gateway).toBe('SSLCOMMERZ');
            expect(extracted.tranId).toBe('SSLCZ-ORD-2002');
            expect(extracted.status).toBe('VALIDATED');
            expect(extracted.amount).toBe('500.00');
            expect(extracted.currency).toBe('BDT');
            // Crucial: riskLevel must NOT be defaulted to '0'
            expect(extracted.riskLevel).toBeUndefined();
            expect(extracted.bankTranId).toBeUndefined();
        });
    });

    // =========================================================================
    // 3. Layer 2: Key Normalization & Sensitive Key Matching
    // =========================================================================
    describe('Key Normalization & Boundaries', () => {
        it('should strip camelCase, snake_case, and kebab-case sensitive keys', () => {
            const sensitiveKeys = [
                'accessToken',
                'clientSecret',
                'authorizationHeader',
                'privateKey',
                'apiKey',
                'cardNumber',
                'card_no',
                'account_number',
                'user_pin',
                'cvv',
                'cvc',
                'set-cookie',
                'sessionKey',
            ];

            for (const key of sensitiveKeys) {
                expect(GatewaySanitizer.isSensitiveKey(key)).toBe(true);
            }
        });

        it('should NOT falsely match legitimate words containing "pan", "pin", "auth", "token"', () => {
            const legitimateKeys = [
                'company',
                'companyName',
                'japan',
                'span',
                'shoppingCart',
                'pinpointLocation',
                'panoramicView',
                'authorName',
            ];

            for (const key of legitimateKeys) {
                expect(GatewaySanitizer.isSensitiveKey(key)).toBe(false);
            }
        });
    });

    // =========================================================================
    // 4. Layer 2: Cycle-Safety & Shared Object Reference Preservation
    // =========================================================================
    describe('Cycle-Safety & Shared Object References', () => {
        it('should preserve legitimate shared object references in sibling branches', () => {
            const sharedStatus = { code: 200, state: 'SUCCESS' };
            const payload = {
                paymentStatus: sharedStatus,
                transactionStatus: sharedStatus,
            };

            const sanitized = GatewaySanitizer.sanitizeDefensive(payload);

            // Both branches must retain the shared data without being discarded
            expect(sanitized.paymentStatus).toEqual({ code: 200, state: 'SUCCESS' });
            expect(sanitized.transactionStatus).toEqual({ code: 200, state: 'SUCCESS' });
        });

        it('should safely break true circular object references without crashing or stack overflow', () => {
            const circularObj: any = { id: 'order-1', note: 'Infinite loop test' };
            circularObj.self = circularObj;

            const sanitized = GatewaySanitizer.sanitizeDefensive(circularObj);

            expect(sanitized.id).toBe('order-1');
            expect(sanitized.note).toBe('Infinite loop test');
            expect(sanitized.self).toBe('[CIRCULAR]');
        });

        it('should safely break self-referencing circular arrays without stack overflow', () => {
            const circularArray: any[] = ['first_item'];
            circularArray.push(circularArray);

            const sanitized = GatewaySanitizer.sanitizeDefensive(circularArray);

            expect(Array.isArray(sanitized)).toBe(true);
            expect(sanitized[0]).toBe('first_item');
            expect(sanitized[1]).toBe('[CIRCULAR_ARRAY]');
        });
    });

    // =========================================================================
    // 5. Layer 2: Array & Nested Object Sanitization
    // =========================================================================
    describe('Nested Arrays & Objects Sanitization', () => {
        it('should recursively sanitize sensitive keys inside nested arrays of objects', () => {
            const payload = {
                orderId: 'ORD-777',
                charges: [
                    {
                        chargeId: 'ch_1',
                        amount: 100,
                        clientSecret: 'secret_to_remove',
                        tokens: ['tok_1', 'tok_2'],
                    },
                    {
                        chargeId: 'ch_2',
                        amount: 200,
                        card_number: '4242424242424242',
                    },
                ],
            };

            const sanitized = GatewaySanitizer.sanitizeDefensive(payload);

            expect(sanitized.orderId).toBe('ORD-777');
            expect(sanitized.charges[0].chargeId).toBe('ch_1');
            expect(sanitized.charges[0].amount).toBe(100);
            expect(sanitized.charges[0].clientSecret).toBeUndefined();
            expect(sanitized.charges[0].tokens).toBeUndefined();
            expect(sanitized.charges[1].chargeId).toBe('ch_2');
            expect(sanitized.charges[1].amount).toBe(200);
            expect(sanitized.charges[1].card_number).toBeUndefined();
        });
    });

    // =========================================================================
    // 6. Layer 2: PAN Detection via Luhn Algorithm
    // =========================================================================
    describe('PAN Detection & Luhn Algorithm Check', () => {
        it('should detect and mask valid Luhn credit card numbers', () => {
            // Standard Luhn-valid test card numbers
            const validVisa = '4532015112830366';
            const validMastercard = '5425233430109903';

            expect(GatewaySanitizer.isValidLuhn(validVisa)).toBe(true);
            expect(GatewaySanitizer.isValidLuhn(validMastercard)).toBe(true);

            const payload = {
                userNote: `Customer paid with ${validVisa}`,
                cleanCard: validMastercard,
            };

            const sanitized = GatewaySanitizer.sanitizeDefensive(payload);
            expect(sanitized.cleanCard).toBe('****-****-****-9903');
        });

        it('should NOT mask 13-19 digit numbers that fail Luhn validation (e.g. tracking/order IDs)', () => {
            // 16-digit string that fails Luhn checksum (order/warehouse tracking ID)
            const nonLuhnId = '1111222233334449';
            expect(GatewaySanitizer.isValidLuhn(nonLuhnId)).toBe(false);

            const payload = {
                trackingCode: nonLuhnId,
            };

            const sanitized = GatewaySanitizer.sanitizeDefensive(payload);
            // Must be preserved without false positive masking
            expect(sanitized.trackingCode).toBe(nonLuhnId);
        });
    });

    // =========================================================================
    // 7. Layer 2: Depth & Collection Bounds
    // =========================================================================
    describe('Depth & Collection Size Limits', () => {
        it('should truncate deeply nested objects beyond max depth (6)', () => {
            const deepPayload: any = { level1: { level2: { level3: { level4: { level5: { level6: { level7: 'too_deep' } } } } } } };

            const sanitized = GatewaySanitizer.sanitizeDefensive(deepPayload);

            expect(sanitized.level1.level2.level3.level4.level5.level6).toBe('[TRUNCATED_MAX_DEPTH]');
        });

        it('should truncate oversized arrays and objects exceeding maxCollectionSize', () => {
            const largeArray = Array.from({ length: 60 }, (_, i) => `item_${i}`);
            const largeObject: Record<string, number> = {};
            for (let i = 0; i < 60; i++) {
                largeObject[`key_${i}`] = i;
            }

            const sanitizedArray = GatewaySanitizer.sanitizeDefensive(largeArray);
            expect(sanitizedArray.length).toBe(51); // 50 items + 1 truncation marker
            expect(sanitizedArray[50]).toBe('[TRUNCATED_MAX_ITEMS]');

            const sanitizedObject = GatewaySanitizer.sanitizeDefensive(largeObject);
            expect(sanitizedObject._truncated).toBe('[TRUNCATED_MAX_KEYS]');
        });
    });

    // =========================================================================
    // 8. Unsupported & Edge Case Types
    // =========================================================================
    describe('Unsupported & Edge Case Types', () => {
        it('should handle null, undefined, functions, and symbols safely', () => {
            expect(GatewaySanitizer.sanitizeDefensive(null)).toBeNull();
            expect(GatewaySanitizer.sanitizeDefensive(undefined)).toBeNull();

            const weirdPayload = {
                validText: 'Hello',
                func: () => 'malicious',
                sym: Symbol('test'),
                createdDate: new Date('2026-11-07T12:00:00Z'),
            };

            const sanitized = GatewaySanitizer.sanitizeDefensive(weirdPayload);
            expect(sanitized.validText).toBe('Hello');
            expect(sanitized.func).toBeNull();
            expect(sanitized.sym).toBeNull();
            expect(sanitized.createdDate).toBe('2026-11-07T12:00:00.000Z');
        });
    });
});
