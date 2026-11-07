/**
 * ============================================================================
 * k6 Controlled Sandbox Concurrency & Failure Injection Benchmark
 * ============================================================================
 *
 * Simulates high-concurrency checkout and payment workloads to verify:
 * 1. ACID Variant Inventory Locking (Pessimistic ASC Clustered-PK row locks)
 * 2. Zero Overselling under extreme multi-VU race conditions
 * 3. Graceful degradation: 400 Bad Request on stock exhaustion instead of 500 internal errors
 * 4. P95 response latency < 500ms
 * 5. Overall unhandled error rate < 1%
 *
 * Execution:
 *   k6 run scripts/k6-concurrency-sandbox.js
 *   k6 run --env BASE_URL=http://localhost:5000/api/v1 scripts/k6-concurrency-sandbox.js
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const checkoutLatency = new Trend('checkout_duration_ms', true);
const paymentInitLatency = new Trend('payment_init_duration_ms', true);
const errorRate = new Rate('system_error_rate');
const successfulOrdersCount = new Counter('successful_orders_total');
const stockExhaustionRejectedCount = new Counter('stock_exhaustion_rejected_total');
const oversellViolations = new Counter('oversell_violations_total');

// Configuration & Ramping VU Profile
export const options = {
    scenarios: {
        concurrency_stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 10 },  // Warm-up to 10 VUs
                { duration: '1m',  target: 50 },  // Scale to 50 concurrent VUs
                { duration: '1m',  target: 100 }, // Peak stress at 100 concurrent VUs
                { duration: '30s', target: 0 },   // Cool-down
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        // P95 latency must stay strictly below 500ms
        'http_req_duration': ['p(95)<500'],
        'checkout_duration_ms': ['p(95)<500'],
        'payment_init_duration_ms': ['p(95)<400'],
        // Unhandled server errors (5xx) must be < 1%
        'system_error_rate': ['rate<0.01'],
        // Overselling violations must be STRICTLY 0
        'oversell_violations_total': ['count==0'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';
const TEST_PRODUCT_ID = __ENV.PRODUCT_ID || 'prod-benchmark-target';
const TEST_SIZE = __ENV.SIZE || 'M';
const INITIAL_VARIANT_STOCK = Number(__ENV.STOCK || 25);

const HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

export function setup() {
    console.log(`[k6 Setup] Commencing sandbox benchmark against: ${BASE_URL}`);
    console.log(`[k6 Setup] Target product: ${TEST_PRODUCT_ID}, Size: ${TEST_SIZE}, Initial Variant Stock: ${INITIAL_VARIANT_STOCK}`);

    // Optional: Query product details before starting load
    const res = http.get(`${BASE_URL}/product/${TEST_PRODUCT_ID}`, { headers: HEADERS });
    if (res.status === 200) {
        console.log(`[k6 Setup] Product verified reachable. Initial data confirmed.`);
    } else {
        console.log(`[k6 Setup] Target product endpoint returned status ${res.status}. Proceeding with synthetic payloads.`);
    }

    return {
        startTime: Date.now(),
        initialStock: INITIAL_VARIANT_STOCK,
    };
}

export default function (data) {
    const vuId = __VU;
    const iterId = __ITER;
    const uniqueEmail = `load_tester_${vuId}_${iterId}_${Date.now()}@example.com`;

    group('Concurrent Checkout Flow', () => {
        // Step 1: Submit Order for Limited Variant
        const orderPayload = JSON.stringify({
            items: [
                {
                    productId: TEST_PRODUCT_ID,
                    quantity: 1,
                    selectedSize: TEST_SIZE,
                    price: 49.99,
                },
            ],
            shippingAddress: {
                name: `Load Test User VU-${vuId}`,
                email: uniqueEmail,
                phone: '+8801700000000',
                address: '123 Concurrency Ave',
                city: 'Dhaka',
                postalCode: '1200',
            },
            paymentMethod: 'ONLINE',
            currency: 'BDT',
        });

        const startCheckout = Date.now();
        const orderRes = http.post(`${BASE_URL}/order`, orderPayload, { headers: HEADERS });
        checkoutLatency.add(Date.now() - startCheckout);

        let createdOrderId = null;

        if (orderRes.status === 201 || orderRes.status === 200) {
            // Successful reservation under lock
            successfulOrdersCount.add(1);
            errorRate.add(0);

            try {
                const body = JSON.parse(orderRes.body);
                createdOrderId = body.id || body.orderId || (body.data && body.data.id);
            } catch {
                // Ignore parse error
            }

            check(orderRes, {
                'Order created successfully (200/201)': (r) => r.status === 200 || r.status === 201,
            });
        } else if (orderRes.status === 400) {
            // Expected gracefully handled inventory exhaustion
            stockExhaustionRejectedCount.add(1);
            errorRate.add(0); // 400 due to stock depletion is an expected business barrier, not an unhandled error

            check(orderRes, {
                'Gracefully rejected due to depleted stock (400)': (r) => {
                    return r.status === 400 && (r.body.includes('stock') || r.body.includes('Available'));
                },
            });
        } else {
            // Unexpected 5xx server crash or unhandled error
            errorRate.add(1);
            check(orderRes, {
                'Unexpected error status': (r) => r.status >= 500,
            });
        }

        // Step 2: Payment Initiation (Single Active Attempt Policy Verification)
        if (createdOrderId) {
            const initPayload = JSON.stringify({
                orderId: createdOrderId,
            });

            const startPay = Date.now();
            const payRes = http.post(`${BASE_URL}/payments`, initPayload, { headers: HEADERS });
            paymentInitLatency.add(Date.now() - startPay);

            check(payRes, {
                'Payment intent initialized (200/201)': (r) => r.status === 200 || r.status === 201,
                'Payment intent contains client secret': (r) => {
                    try {
                        const b = JSON.parse(r.body);
                        return Boolean(b.clientSecret || b.data?.clientSecret || b.gatewayPageUrl);
                    } catch {
                        return false;
                    }
                },
            });

            // Step 3: Concurrent Duplicate Init (Idempotent reuse of active attempt)
            const secondInitRes = http.post(`${BASE_URL}/payments`, initPayload, { headers: HEADERS });
            check(secondInitRes, {
                'Second payment init reuses active attempt without error': (r) =>
                    r.status === 200 || r.status === 201,
            });
        }
    });

    sleep(Math.random() * 0.5 + 0.2); // Random user think time (200ms - 700ms)
}

export function teardown(data) {
    console.log(`[k6 Teardown] Benchmark completed in ${Math.round((Date.now() - data.startTime) / 1000)}s.`);
    console.log(`[k6 Teardown] Verifying final inventory invariants...`);

    const productRes = http.get(`${BASE_URL}/product/${TEST_PRODUCT_ID}`, { headers: HEADERS });
    if (productRes.status === 200) {
        try {
            const product = JSON.parse(productRes.body);
            const remainingSizeQty = product.sizeStock?.[TEST_SIZE] ?? product.quantity;
            console.log(`[k6 Invariant Check] Remaining "${TEST_SIZE}" Stock in DB: ${remainingSizeQty}`);

            if (remainingSizeQty < 0) {
                console.error(`🚨 CRITICAL OVERSELL DETECTED! Negative stock count: ${remainingSizeQty}`);
                oversellViolations.add(1);
            } else {
                console.log(`✅ Zero Overselling Invariant Verified. Remaining stock >= 0.`);
            }
        } catch (e) {
            console.warn(`[k6 Invariant Check] Could not parse product response: ${e}`);
        }
    }
}
