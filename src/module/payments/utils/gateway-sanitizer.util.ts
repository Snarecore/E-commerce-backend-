/**
 * ============================================================================
 * Gateway Sanitizer & Audit Metadata Security Utility
 * ============================================================================
 *
 * Implements a strict, multi-layer security boundary:
 * 1. Layer 1: Gateway-Specific Explicit Allowlist (Primary Security Boundary)
 *    - Never persists raw gateway SDK objects or arbitrary vendor responses.
 *    - Validates every retained field (type, length, ISO format, bounds).
 *    - Unknown and unnecessary fields are dropped at source.
 * 2. Layer 2: Defensive Sanitizer (Defense-in-Depth for arbitrary metadata)
 *    - Active-path ancestor Set (preserves legitimate shared object references,
 *      while reliably catching true circular objects and self-referencing arrays).
 *    - Strict key normalization (camelCase, snake_case, kebab-case) with boundary
 *      matching (prevents false positives like "company", "japan", "span").
 *    - Conservative PAN detection backed by Luhn checksum validation.
 *    - Bounded recursion (maxDepth: 6) and collection sizing (maxItems: 50).
 *
 * NOTE: This utility provides strict application-level defense-in-depth and data
 * minimization. It does NOT by itself constitute PCI-DSS compliance certification,
 * which requires holistic environment assessment (tokenization, network segmentation, etc.).
 * ============================================================================
 */

export interface SanitizerOptions {
    maxDepth?: number;
    maxCollectionSize?: number;
}

export class GatewaySanitizer {
    /**
     * Validates a candidate string of 13-19 digits against the Luhn (Mod 10) checksum.
     * Used for conservative PAN detection (reducing false positives on order/tracking IDs).
     */
    static isValidLuhn(digits: string): boolean {
        if (!/^\d{13,19}$/.test(digits)) return false;
        let sum = 0;
        let shouldDouble = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits.charAt(i), 10);
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return sum % 10 === 0;
    }

    /**
     * Normalizes key and checks against sensitive authentication/credential patterns.
     * Protects legitimate words (e.g. "company", "japan", "span", "pinpoint") from being dropped.
     */
    static isSensitiveKey(key: string): boolean {
        if (!key || typeof key !== 'string') return false;

        // Convert camelCase, kebab-case, dots and spaces to snake_case
        const normalized = key
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[-.\s]/g, '_')
            .toLowerCase();

        // Exact compound sensitive phrases
        const compoundSensitivePatterns = [
            'card_number',
            'card_no',
            'account_number',
            'client_secret',
            'access_token',
            'refresh_token',
            'private_key',
            'api_key',
            'set_cookie',
            'auth_header',
            'authorization_header',
            'session_key',
            'bank_gw',
            'gw_version'
        ];
        if (compoundSensitivePatterns.some(p => normalized.includes(p))) {
            return true;
        }

        // Tokenized boundary matching for single sensitive words (including plurals)
        const tokens = normalized.split('_');
        const exactSensitiveTokens = new Set([
            'cvv',
            'cvc',
            'pin',
            'pan',
            'password',
            'passwords',
            'secret',
            'secrets',
            'token',
            'tokens',
            'bearer',
            'auth',
            'authorization',
            'cookie',
            'cookies',
            'apikey',
            'sessionkey'
        ]);

        return tokens.some(t => {
            if (exactSensitiveTokens.has(t)) return true;
            if (t.endsWith('s') && exactSensitiveTokens.has(t.slice(0, -1))) return true;
            return false;
        });
    }

    /**
     * Layer 1 Allowlist: Stripe PaymentIntent Audit Metadata Extractor.
     * Explicitly whitelists and validates only verified fields.
     * Drops all raw SDK internals, customer objects, and billing details.
     */
    static extractStripeAuditMetadata(intent: any): Record<string, any> {
        if (!intent || typeof intent !== 'object') return {};

        const safe: Record<string, any> = { gateway: 'STRIPE' };

        // 1. intentId: format and length verification
        if (typeof intent.id === 'string' && /^pi_[a-zA-Z0-9_\-]{10,60}$/.test(intent.id)) {
            safe.intentId = intent.id;
        }

        // 2. status: strictly allowlisted Stripe PaymentIntent statuses
        const ALLOWED_STRIPE_STATUSES = new Set([
            'requires_payment_method',
            'requires_confirmation',
            'requires_action',
            'processing',
            'requires_capture',
            'canceled',
            'succeeded'
        ]);
        if (typeof intent.status === 'string' && ALLOWED_STRIPE_STATUSES.has(intent.status)) {
            safe.status = intent.status;
        }

        // 3. amount: finite non-negative integer (minor units / cents)
        if (
            typeof intent.amount === 'number' &&
            Number.isFinite(intent.amount) &&
            intent.amount >= 0 &&
            Number.isInteger(intent.amount)
        ) {
            safe.amount = intent.amount;
        }

        // 4. currency: ISO 4217 3-letter currency code
        if (typeof intent.currency === 'string' && /^[a-zA-Z]{3}$/.test(intent.currency.trim())) {
            safe.currency = intent.currency.trim().toUpperCase();
        }

        // 5. payment_method_types: validated array of safe string tokens
        if (Array.isArray(intent.payment_method_types)) {
            safe.paymentMethodTypes = intent.payment_method_types
                .filter((t: any): t is string => typeof t === 'string' && /^[a-z0-9_]{2,30}$/.test(t))
                .slice(0, 10);
        }

        // 6. canceled_at: valid unix timestamp conversion
        if (
            typeof intent.canceled_at === 'number' &&
            Number.isFinite(intent.canceled_at) &&
            intent.canceled_at > 0
        ) {
            const d = new Date(intent.canceled_at * 1000);
            if (!isNaN(d.getTime())) {
                safe.canceledAt = d.toISOString();
            }
        }

        // 7. cancellation_reason: safe bounded string
        if (typeof intent.cancellation_reason === 'string') {
            const cleanReason = intent.cancellation_reason.replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 50);
            if (cleanReason.length > 0) {
                safe.cancellationReason = cleanReason;
            }
        }

        // 8. created: valid unix timestamp conversion
        if (
            typeof intent.created === 'number' &&
            Number.isFinite(intent.created) &&
            intent.created > 0
        ) {
            const d = new Date(intent.created * 1000);
            if (!isNaN(d.getTime())) {
                safe.created = d.toISOString();
            }
        }

        return safe;
    }

    /**
     * Layer 1 Allowlist: SSLCommerz Transaction Audit Metadata Extractor.
     * Supports both root query response and element array representations.
     * Validates every field against strict business constraints; no undocumented defaults.
     */
    static extractSslcommerzAuditMetadata(raw: any): Record<string, any> {
        if (!raw || typeof raw !== 'object') return {};

        const elem = Array.isArray(raw?.element)
            ? raw.element[0]
            : (raw?.element && typeof raw.element === 'object' ? raw.element : raw);

        if (!elem || typeof elem !== 'object') return {};

        const safe: Record<string, any> = { gateway: 'SSLCOMMERZ' };

        // 1. tranId: alphanumeric with safe delimiters
        const tranIdCandidate = elem.tran_id || raw.tran_id;
        if (typeof tranIdCandidate === 'string' && /^[a-zA-Z0-9_\-:.]{3,100}$/.test(tranIdCandidate.trim())) {
            safe.tranId = tranIdCandidate.trim();
        }

        // 2. valId: alphanumeric with safe delimiters
        const valIdCandidate = elem.val_id || raw.val_id;
        if (typeof valIdCandidate === 'string' && /^[a-zA-Z0-9_\-:.]{3,100}$/.test(valIdCandidate.trim())) {
            safe.valId = valIdCandidate.trim();
        }

        // 3. status: allowlisted SSLCommerz verification statuses
        const ALLOWED_SSLCZ_STATUSES = new Set([
            'VALID',
            'VALIDATED',
            'FAILED',
            'CANCELLED',
            'UNATTEMPTED',
            'EXPIRED'
        ]);
        const statusCandidate = String(elem.status || raw.status || '').toUpperCase().trim();
        if (ALLOWED_SSLCZ_STATUSES.has(statusCandidate)) {
            safe.status = statusCandidate;
        }

        // 4. amount: finite decimal string formatted to 2 decimal places
        const rawAmt = elem.amount || elem.currency_amount || raw.amount || raw.currency_amount;
        if (rawAmt !== undefined && rawAmt !== null) {
            const parsed = Number(rawAmt);
            if (Number.isFinite(parsed) && parsed >= 0) {
                safe.amount = parsed.toFixed(2);
            }
        }

        // 5. currency: ISO 4217 3-letter currency code
        const rawCurr = elem.currency || elem.currency_type || raw.currency || raw.currency_type;
        if (typeof rawCurr === 'string' && /^[a-zA-Z]{3}$/.test(rawCurr.trim())) {
            safe.currency = rawCurr.trim().toUpperCase();
        }

        // 6. bankTranId: bounded alphanumeric string
        if (typeof elem.bank_tran_id === 'string' && /^[a-zA-Z0-9_\-:.]{3,100}$/.test(elem.bank_tran_id.trim())) {
            safe.bankTranId = elem.bank_tran_id.trim();
        }

        // 7. card metadata (sanitized single token fields)
        if (typeof elem.card_type === 'string' && /^[a-zA-Z0-9_\- ]{2,50}$/.test(elem.card_type.trim())) {
            safe.cardType = elem.card_type.trim();
        }
        if (typeof elem.card_brand === 'string' && /^[a-zA-Z0-9_\- ]{2,50}$/.test(elem.card_brand.trim())) {
            safe.cardBrand = elem.card_brand.trim();
        }
        if (typeof elem.card_issuer === 'string' && /^[a-zA-Z0-9_\- ]{2,50}$/.test(elem.card_issuer.trim())) {
            safe.cardIssuer = elem.card_issuer.trim();
        }

        // 8. riskLevel: ONLY if explicitly present (do NOT default to '0')
        if (elem.risk_level === '0' || elem.risk_level === '1' || elem.risk_level === 0 || elem.risk_level === 1) {
            safe.riskLevel = String(elem.risk_level);
        }

        // 9. tranDate: bounded string representation
        if (typeof elem.tran_date === 'string' && elem.tran_date.trim().length > 0) {
            safe.tranDate = elem.tran_date.trim().slice(0, 50);
        }

        return safe;
    }

    /**
     * Layer 2 Defense-in-Depth: Cycle-Safe, Array-Safe, Luhn-Aware Metadata Sanitizer.
     * Uses active-path ancestor Set (preserves legitimate shared object references).
     * Prevents stack overflows on self-referencing arrays and circular objects.
     */
    static sanitizeDefensive(
        raw: any,
        ancestorPath = new Set<object>(),
        depth = 0,
        options: SanitizerOptions = {}
    ): any {
        const maxDepth = options.maxDepth ?? 6;
        const maxCollectionSize = options.maxCollectionSize ?? 50;

        if (raw === null || raw === undefined) return raw ?? null;

        // Primitives
        if (typeof raw !== 'object') {
            if (typeof raw === 'function' || typeof raw === 'symbol') {
                return null;
            }
            if (typeof raw === 'string') {
                // Check for potential PAN (digits possibly separated by spaces or hyphens)
                const cleanDigits = raw.replace(/[\s-]/g, '');
                if (/^\d{13,19}$/.test(cleanDigits) && GatewaySanitizer.isValidLuhn(cleanDigits)) {
                    return `****-****-****-${cleanDigits.slice(-4)}`;
                }
            }
            return raw;
        }

        // Dates
        if (raw instanceof Date) {
            return isNaN(raw.getTime()) ? null : raw.toISOString();
        }

        // Errors
        if (raw instanceof Error) {
            return { name: raw.name, message: raw.message };
        }

        // Max Depth Guard
        if (depth >= maxDepth) {
            return '[TRUNCATED_MAX_DEPTH]';
        }

        // Active Path Ancestor Cycle Check (Cycle Detection)
        if (ancestorPath.has(raw)) {
            return Array.isArray(raw) ? '[CIRCULAR_ARRAY]' : '[CIRCULAR]';
        }

        // Push current object/array to active recursion path
        ancestorPath.add(raw);

        try {
            if (Array.isArray(raw)) {
                const result: any[] = [];
                const slice = raw.slice(0, maxCollectionSize);
                for (const item of slice) {
                    result.push(GatewaySanitizer.sanitizeDefensive(item, ancestorPath, depth + 1, options));
                }
                if (raw.length > maxCollectionSize) {
                    result.push('[TRUNCATED_MAX_ITEMS]');
                }
                return result;
            }

            const result: Record<string, any> = {};
            const entries = Object.entries(raw);
            const slice = entries.slice(0, maxCollectionSize);

            for (const [key, val] of slice) {
                if (GatewaySanitizer.isSensitiveKey(key)) {
                    continue; // Drop sensitive field
                }
                result[key] = GatewaySanitizer.sanitizeDefensive(val, ancestorPath, depth + 1, options);
            }

            if (entries.length > maxCollectionSize) {
                result._truncated = '[TRUNCATED_MAX_KEYS]';
            }

            return result;
        } finally {
            // Unwind: remove from active ancestor path so shared non-circular objects are preserved!
            ancestorPath.delete(raw);
        }
    }
}
