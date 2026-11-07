import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Orders } from '../../order/entity/order.entity';
import { Payments } from '../entities/payment.entity';
import { PaymentEvents } from '../entities/payment-event.entity';
import { PaymentRefunds } from '../entities/payment-refund.entity';
import { PaymentAttemptStatus, PaymentEventSource, PaymentMethodType, RefundStatus } from '../enums/payment.enum';
import { OrderStatus, PaymentStatus } from '../../../enums/order-status.enum';
import { SslcommerzService } from './sslcommerz.service';
import { CurrencyUtils } from '../../../utils/currency.utils';
import { EventFingerprintBuilder } from '../utils/event-fingerprint.builder';
import { PaymentStateMachine } from '../utils/payment-state-machine';
import { PaymentOutboxService } from './payment-outbox.service';
import { Product } from '../../inventory/product/entities/product.entity';
import { OrderSummary } from '../../order-summary/entity/order-summary.entity';

@Injectable()
export class PaymentConfirmationService {
    private readonly logger = new Logger(PaymentConfirmationService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly sslcommerzService: SslcommerzService
    ) {}

    /**
     * Map raw SSLCommerz card_type string to normalized PaymentMethodType enum.
     */
    private mapCardTypeToMethod(rawCardType?: string): PaymentMethodType {
        const type = (rawCardType || '').toUpperCase();
        if (type.includes('BKASH')) return PaymentMethodType.BKASH;
        if (type.includes('NAGAD')) return PaymentMethodType.NAGAD;
        if (type.includes('ROCKET')) return PaymentMethodType.ROCKET;
        if (type.includes('UPAY')) return PaymentMethodType.UPAY;
        if (type.includes('VISA')) return PaymentMethodType.VISA;
        if (type.includes('MASTER')) return PaymentMethodType.MASTERCARD;
        if (type.includes('DBBL') || type.includes('NEXUS') || type.includes('CITY') || type.includes('BANK')) {
            return PaymentMethodType.BANK;
        }
        return PaymentMethodType.UNKNOWN;
    }

    /**
     * Centralized, Non-blocking, Race-Condition-Free Payment Confirmation Handler.
     * Called by Browser Callback, Async IPN Webhook, and Reconciliation Worker.
     */
    async confirmPayment(
        valId: string,
        tranId: string,
        source: PaymentEventSource,
        rawPayload?: Record<string, any>
    ): Promise<{ success: boolean; message: string; orderId?: string; humanOrderId?: string; paymentStatus?: string }> {
        // Step 1: Pre-read Payment record in read-only mode (Zero DB lock)
        const paymentRepo = this.dataSource.getRepository(Payments);
        const initialPayment = await paymentRepo.findOne({
            where: { tranId },
            relations: ['order']
        });

        if (!initialPayment) {
            this.logger.warn(`[Payment Confirmation] No payment found for tranId: "${tranId}"`);
            throw new NotFoundException(`Payment record not found for transaction: ${tranId}`);
        }

        const humanOrderId = initialPayment.order?.orderId;

        // Idempotency early return: if already PAID, exit without any duplicate processing
        if (initialPayment.status === PaymentAttemptStatus.PAID) {
            this.logger.log(`[Payment Confirmation] Payment for tranId "${tranId}" is already PAID. Skipping.`);
            return {
                success: true,
                message: 'Payment already confirmed',
                orderId: initialPayment.orderId,
                humanOrderId,
                paymentStatus: 'PAID'
            };
        }

        // Step 2: External Server-to-Server Validation Call (Zero DB lock)
        let validationData: any = null;
        try {
            validationData = await this.sslcommerzService.validateTransaction(valId);
        } catch (netErr: any) {
            this.logger.error(`[Payment Confirmation] SSLCommerz Validation API Network Timeout/Error for valId: ${valId}`);
            // Do NOT mark failed on network timeout; keep UNKNOWN so reconciliation handles it
            return {
                success: false,
                message: 'Gateway validation timed out. Scheduled for background reconciliation.',
                orderId: initialPayment.orderId,
                paymentStatus: 'UNKNOWN'
            };
        }

        // Step 3: Validate Validation Response & Security Integrity
        const status = (validationData?.status || '').toUpperCase();
        const isValid = status === 'VALID' || status === 'VALIDATED';

        if (!isValid) {
            this.logger.warn(`[Payment Confirmation] Validation rejected for valId "${valId}". Gateway status: "${status}"`);
            await this.handleFailedAttempt(initialPayment, validationData, source);
            return {
                success: false,
                message: `Gateway reported status: ${status}`,
                orderId: initialPayment.orderId,
                paymentStatus: 'FAILED'
            };
        }

        // 🛡️ CRITICAL SECURITY CHECK: Transaction ID Integrity (prevents val_id spoofing across different orders)
        const gatewayTranId = String(validationData?.tran_id || '').trim();
        if (!gatewayTranId || gatewayTranId !== initialPayment.tranId.trim()) {
            this.logger.error(
                `[Security Alert: SPOOFING DETECTED] TranId mismatch! Expected: "${initialPayment.tranId}", Gateway Reported: "${gatewayTranId}" for valId: ${valId}`
            );
            return {
                success: false,
                message: 'Security validation failed: Transaction ID mismatch',
                orderId: initialPayment.orderId,
                paymentStatus: 'REJECTED'
            };
        }

        // Mathematical string/decimal precision validation
        const valAmount = String(validationData?.amount || '0');
        const isAmountMatch = CurrencyUtils.isAmountEqual(initialPayment.amount, valAmount);

        if (!isAmountMatch) {
            this.logger.error(
                `[Security Alert] Amount tampering detected! DB Amount: ${initialPayment.amount}, Gateway Amount: ${valAmount} for tranId: ${tranId}`
            );
            return {
                success: false,
                message: 'Security validation failed: Amount mismatch',
                orderId: initialPayment.orderId,
                paymentStatus: 'REJECTED'
            };
        }

        const isCurrencyMatch = (validationData?.currency || '').toUpperCase() === (initialPayment.currency || 'BDT').toUpperCase();
        if (!isCurrencyMatch) {
            this.logger.error(`[Security Alert] Currency mismatch: expected ${initialPayment.currency}, got ${validationData?.currency}`);
            return {
                success: false,
                message: 'Security validation failed: Currency mismatch',
                orderId: initialPayment.orderId,
                paymentStatus: 'REJECTED'
            };
        }

        // Step 4: Short-lived DB Transaction (< 5ms) with Strict Uniform Lock Ordering (Orders -> Payments)
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Strict lock order: 1. Order row lock
            const lockedOrder = await queryRunner.manager.findOne(Orders, {
                where: { id: initialPayment.orderId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedOrder) {
                throw new NotFoundException(`Order not found: ${initialPayment.orderId}`);
            }

            // Strict lock order: 2. Payment row lock
            const lockedPayment = await queryRunner.manager.findOne(Payments, {
                where: { id: initialPayment.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedPayment) {
                throw new NotFoundException(`Payment not found: ${initialPayment.id}`);
            }

            // Inside-lock re-check: another process might have committed right before lock acquisition
            if (lockedPayment.status === PaymentAttemptStatus.PAID) {
                const isTranMatch = (lockedPayment.tranId || '').trim() === tranId.trim();
                const isValMatch = !lockedPayment.valId || lockedPayment.valId === valId;
                const isCurrMatch = (lockedPayment.currency || 'BDT').toUpperCase() === (validationData?.currency || 'BDT').toUpperCase();
                const isAmtMatch = CurrencyUtils.isAmountEqual(lockedPayment.amount, valAmount);

                if (isTranMatch && isValMatch && isCurrMatch && isAmtMatch) {
                    this.logger.log(`[Payment Confirmation] Duplicate callback inside lock for tranId "${tranId}". Already confirmed with matching credentials.`);
                    await queryRunner.rollbackTransaction();
                    return {
                        success: true,
                        message: 'Payment already processed by concurrent request',
                        orderId: lockedOrder.id,
                        humanOrderId: lockedOrder.orderId,
                        paymentStatus: 'PAID'
                    };
                } else {
                    this.logger.error(`[Security Alert: Invariant Violation] Inside lock check: already PAID tranId "${tranId}" credentials mismatch!`);
                    await queryRunner.rollbackTransaction();
                    return {
                        success: false,
                        message: 'Credential mismatch on already confirmed payment',
                        orderId: lockedOrder.id,
                        humanOrderId: lockedOrder.orderId,
                        paymentStatus: 'REJECTED'
                    };
                }
            }

            // Check Risk Level
            const isRisk = String(validationData?.risk_level || '0') === '1';

            if (isRisk) {
                this.logger.warn(`[Payment Risk Alert] Gateway flagged risk_level = 1 for tranId: ${tranId}`);
                lockedPayment.status = PaymentAttemptStatus.PROCESSING;
                lockedPayment.needsAdminReview = true;
                lockedPayment.adminReviewReason = 'SUSPECTED_FRAUD_RISK_1';
                lockedPayment.valId = valId;
                lockedPayment.bankTranId = validationData.bank_tran_id || null;
                lockedPayment.cardType = validationData.card_type || null;
                lockedPayment.cardIssuer = validationData.card_issuer || null;
                lockedPayment.cardBrand = validationData.card_brand || null;
                lockedPayment.maskedAccountNo = validationData.card_no || null;
                await queryRunner.manager.save(lockedPayment);

                lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                await queryRunner.manager.save(lockedOrder);

                await this.recordPaymentEvent(queryRunner, lockedPayment, 'RISK_FLAGGED_PROCESSING', source, status, validationData);
                await queryRunner.commitTransaction();

                return {
                    success: true,
                    message: 'Payment flagged for admin review (risk_level = 1)',
                    orderId: lockedOrder.id,
                    humanOrderId: lockedOrder.orderId,
                    paymentStatus: 'REVIEW_REQUIRED'
                };
            }

            // Legitimate Safe Payment Confirmation (risk_level = 0)
            // Conditional Update enforces state transition invariant at the DB engine level
            const updateResult = await queryRunner.manager
                .createQueryBuilder()
                .update(Payments)
                .set({
                    status: PaymentAttemptStatus.PAID,
                    valId: valId,
                    bankTranId: validationData.bank_tran_id || null,
                    cardType: validationData.card_type || null,
                    cardIssuer: validationData.card_issuer || null,
                    cardBrand: validationData.card_brand || null,
                    maskedAccountNo: validationData.card_no || null,
                    paymentMethod: this.mapCardTypeToMethod(validationData.card_type),
                    paidAt: new Date(),
                    needsAdminReview: false,
                    adminReviewReason: null
                })
                .where("id = :id AND status IN (:...allowedStatuses)", {
                    id: lockedPayment.id,
                    allowedStatuses: [
                        PaymentAttemptStatus.PENDING,
                        PaymentAttemptStatus.PROCESSING,
                        PaymentAttemptStatus.UNKNOWN
                    ]
                })
                .execute();

            if (updateResult.affected === 0) {
                // Row was NOT in [PENDING, PROCESSING, UNKNOWN]. Perform deep branching:
                const freshPayment = await queryRunner.manager.findOne(Payments, {
                    where: { id: lockedPayment.id }
                });

                if (!freshPayment) {
                    throw new NotFoundException(`Payment record not found: ${lockedPayment.id}`);
                }

                // Branch 1: Idempotent duplicate IPN / Webhook / Browser callback (already PAID)
                if (freshPayment.status === PaymentAttemptStatus.PAID) {
                    const isTranMatch = (freshPayment.tranId || '').trim() === tranId.trim();
                    const isValMatch = !freshPayment.valId || freshPayment.valId === valId;
                    const isCurrMatch = (freshPayment.currency || 'BDT').toUpperCase() === (validationData?.currency || 'BDT').toUpperCase();
                    const isAmtMatch = CurrencyUtils.isAmountEqual(freshPayment.amount, valAmount);

                    if (isTranMatch && isValMatch && isCurrMatch && isAmtMatch) {
                        this.logger.log(`[Payment Confirmation] Duplicate callback for tranId "${tranId}". Already confirmed with matching gateway credentials.`);
                        await queryRunner.commitTransaction();
                        return {
                            success: true,
                            message: 'Already confirmed with matching gateway credentials',
                            orderId: lockedOrder.id,
                            humanOrderId: lockedOrder.orderId,
                            paymentStatus: 'PAID'
                        };
                    } else {
                        this.logger.error(`[Security Alert: Invariant Violation] Already PAID tranId "${tranId}" credentials mismatch!`);
                        await queryRunner.rollbackTransaction();
                        return {
                            success: false,
                            message: 'Credential mismatch on already confirmed payment',
                            orderId: lockedOrder.id,
                            humanOrderId: lockedOrder.orderId,
                            paymentStatus: 'REJECTED'
                        };
                    }
                }

                // Branch 2: Late Payment for EXPIRED, CANCELLED, or FAILED attempt, or CANCELLED order
                if (
                    freshPayment.status === PaymentAttemptStatus.EXPIRED ||
                    freshPayment.status === PaymentAttemptStatus.CANCELLED ||
                    freshPayment.status === PaymentAttemptStatus.FAILED ||
                    lockedOrder.status === OrderStatus.CANCELLED
                ) {
                    this.logger.warn(
                        `[Late Payment Detected] Payment ${freshPayment.id} (status: ${freshPayment.status}) or Order ${lockedOrder.orderId} (status: ${lockedOrder.status}) was cancelled/expired. Initiating Atomic Recovery.`
                    );

                    const isStockReReserved = await this.tryReReserveStock(queryRunner, lockedOrder);

                    if (isStockReReserved) {
                        await queryRunner.manager.update(Payments, freshPayment.id, {
                            status: PaymentAttemptStatus.PAID,
                            valId: valId,
                            bankTranId: validationData.bank_tran_id || null,
                            cardType: validationData.card_type || null,
                            cardIssuer: validationData.card_issuer || null,
                            cardBrand: validationData.card_brand || null,
                            maskedAccountNo: validationData.card_no || null,
                            paymentMethod: this.mapCardTypeToMethod(validationData.card_type),
                            paidAt: new Date(),
                            needsAdminReview: false,
                            adminReviewReason: null
                        });

                        lockedOrder.status = OrderStatus.ORDER_PLACED;
                        lockedOrder.paymentStatus = PaymentStatus.PAID;
                        await queryRunner.manager.save(lockedOrder);

                        await this.recordPaymentEvent(queryRunner, freshPayment, 'LATE_PAYMENT_RE_RESERVED', source, status, validationData);
                        await PaymentOutboxService.enqueueEvent(queryRunner, 'PAYMENT', freshPayment.id, 'PAYMENT_CONFIRMED', {
                            paymentId: freshPayment.id,
                            orderId: lockedOrder.orderId,
                            tranId: freshPayment.tranId,
                            valId,
                            amount: freshPayment.amount,
                            latePayment: true
                        });
                        await queryRunner.commitTransaction();

                        this.logger.log(`[Late Payment Recovery Succeeded] Stock secured and Order ${lockedOrder.orderId} revived.`);
                        return {
                            success: true,
                            message: 'Late payment recovered successfully and stock re-reserved',
                            orderId: lockedOrder.id,
                            humanOrderId: lockedOrder.orderId,
                            paymentStatus: 'PAID'
                        };
                    } else {
                        await queryRunner.manager.update(Payments, freshPayment.id, {
                            status: PaymentAttemptStatus.PAID,
                            valId: valId,
                            bankTranId: validationData.bank_tran_id || null,
                            cardType: validationData.card_type || null,
                            cardIssuer: validationData.card_issuer || null,
                            cardBrand: validationData.card_brand || null,
                            maskedAccountNo: validationData.card_no || null,
                            paymentMethod: this.mapCardTypeToMethod(validationData.card_type),
                            paidAt: new Date(),
                            needsAdminReview: true,
                            adminReviewReason: 'LATE_PAYMENT_STOCK_EXHAUSTED'
                        });

                        lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                        await queryRunner.manager.save(lockedOrder);

                        const refundRecord = queryRunner.manager.create(PaymentRefunds, {
                            paymentId: freshPayment.id,
                            refundId: `REF-${lockedOrder.orderId}-${Date.now().toString().slice(-4)}`,
                            amount: freshPayment.amount,
                            status: RefundStatus.PENDING,
                            reason: 'LATE_PAYMENT_STOCK_EXHAUSTED',
                            initiatedBy: 'SYSTEM',
                            idempotencyKey: `auto_refund_late_pay_${freshPayment.id}`
                        });
                        await queryRunner.manager.save(refundRecord);

                        await this.recordPaymentEvent(queryRunner, freshPayment, 'LATE_PAYMENT_REFUND_INITIATED', source, status, validationData);
                        await PaymentOutboxService.enqueueEvent(queryRunner, 'REFUND', refundRecord.id || freshPayment.id, 'REFUND_PENDING', {
                            paymentId: freshPayment.id,
                            orderId: lockedOrder.orderId,
                            amount: freshPayment.amount,
                            reason: 'LATE_PAYMENT_STOCK_EXHAUSTED'
                        });
                        await queryRunner.commitTransaction();

                        this.logger.warn(`[Late Payment Stock Exhausted] Order ${lockedOrder.orderId} kept cancelled. Refund record created.`);
                        return {
                            success: true,
                            message: 'Late payment received but stock is exhausted. Refund initiated.',
                            orderId: lockedOrder.id,
                            humanOrderId: lockedOrder.orderId,
                            paymentStatus: 'REVIEW_REQUIRED'
                        };
                    }
                }

                // Branch 3: Collision with other unexpected states
                this.logger.warn(`[Payment State Collision] tranId "${tranId}" is in unexpected status "${freshPayment.status}". Rolling back.`);
                await queryRunner.rollbackTransaction();
                return {
                    success: false,
                    message: `Payment is currently in ${freshPayment.status} state. Scheduled for review.`,
                    orderId: lockedOrder.id,
                    humanOrderId: lockedOrder.orderId,
                    paymentStatus: freshPayment.status
                };
            }

            // affected === 1: Successfully transitioned from [PENDING, PROCESSING, UNKNOWN] to PAID
            lockedPayment.status = PaymentAttemptStatus.PAID;
            lockedPayment.valId = valId;
            lockedPayment.bankTranId = validationData.bank_tran_id || null;
            lockedPayment.cardType = validationData.card_type || null;
            lockedPayment.cardIssuer = validationData.card_issuer || null;
            lockedPayment.cardBrand = validationData.card_brand || null;
            lockedPayment.maskedAccountNo = validationData.card_no || null;
            lockedPayment.paymentMethod = this.mapCardTypeToMethod(validationData.card_type);
            lockedPayment.paidAt = new Date();

            // Check if Order was previously CANCELLED while Payment was still pending
            if (lockedOrder.status === OrderStatus.CANCELLED) {
                this.logger.warn(`[Late Payment Detected] Order ${lockedOrder.orderId} was CANCELLED. Initiating Atomic Recovery.`);
                const isStockReReserved = await this.tryReReserveStock(queryRunner, lockedOrder);

                if (isStockReReserved) {
                    lockedOrder.status = OrderStatus.ORDER_PLACED;
                    lockedOrder.paymentStatus = PaymentStatus.PAID;
                    await queryRunner.manager.save(lockedOrder);
                    await this.recordPaymentEvent(queryRunner, lockedPayment, 'LATE_PAYMENT_RE_RESERVED', source, status, validationData);
                    await PaymentOutboxService.enqueueEvent(queryRunner, 'PAYMENT', lockedPayment.id, 'PAYMENT_CONFIRMED', {
                        paymentId: lockedPayment.id,
                        orderId: lockedOrder.orderId,
                        tranId: lockedPayment.tranId,
                        valId,
                        amount: lockedPayment.amount,
                        latePayment: true
                    });
                } else {
                    this.logger.error(`[Late Payment Recovery Failed] Insufficient stock to re-reserve for order ${lockedOrder.orderId}. Initiating Refund Record.`);
                    lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                    await queryRunner.manager.save(lockedOrder);

                    lockedPayment.needsAdminReview = true;
                    lockedPayment.adminReviewReason = 'LATE_PAYMENT_STOCK_EXHAUSTED';
                    await queryRunner.manager.save(lockedPayment);

                    const refundRecord = queryRunner.manager.create(PaymentRefunds, {
                        paymentId: lockedPayment.id,
                        refundId: `REF-${lockedOrder.orderId}-${Date.now().toString().slice(-4)}`,
                        amount: lockedPayment.amount,
                        status: RefundStatus.PENDING,
                        reason: 'LATE_PAYMENT_STOCK_EXHAUSTED',
                        initiatedBy: 'SYSTEM',
                        idempotencyKey: `auto_refund_late_pay_${lockedPayment.id}`
                    });
                    await queryRunner.manager.save(refundRecord);

                    await this.recordPaymentEvent(queryRunner, lockedPayment, 'LATE_PAYMENT_REFUND_INITIATED', source, status, validationData);
                    await PaymentOutboxService.enqueueEvent(queryRunner, 'REFUND', refundRecord.id || lockedPayment.id, 'REFUND_PENDING', {
                        paymentId: lockedPayment.id,
                        orderId: lockedOrder.orderId,
                        amount: lockedPayment.amount,
                        reason: 'LATE_PAYMENT_STOCK_EXHAUSTED'
                    });
                }
            } else {
                // Standard Normal Order Confirmation
                lockedOrder.status = OrderStatus.ORDER_PLACED;
                lockedOrder.paymentStatus = PaymentStatus.PAID;
                await queryRunner.manager.save(lockedOrder);
                await this.recordPaymentEvent(queryRunner, lockedPayment, 'PAYMENT_CONFIRMED', source, status, validationData);
                await PaymentOutboxService.enqueueEvent(queryRunner, 'PAYMENT', lockedPayment.id, 'PAYMENT_CONFIRMED', {
                    paymentId: lockedPayment.id,
                    orderId: lockedOrder.orderId,
                    tranId: lockedPayment.tranId,
                    valId,
                    amount: lockedPayment.amount
                });
            }

            await queryRunner.commitTransaction();
            this.logger.log(`[Payment Confirmation] Successfully confirmed payment for tranId: ${tranId}, Order: ${lockedOrder.orderId}`);

            return {
                success: true,
                message: 'Payment confirmed successfully',
                orderId: lockedOrder.id,
                humanOrderId: lockedOrder.orderId,
                paymentStatus: 'PAID'
            };
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`[Payment Confirmation Transaction Error] ${err?.message}`, err?.stack);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Atomically attempts to re-reserve stock if an order was cancelled before late payment arrived.
     * Enforces the exact same ASC Clustered-PK row locking order as Checkout.
     */
    private async tryReReserveStock(queryRunner: any, order: Orders): Promise<boolean> {
        try {
            const summaries = await queryRunner.manager.find(OrderSummary, {
                where: { orderId: order.orderId }
            });

            if (!summaries || summaries.length === 0) return false;

            // 1. Aggregate required stock by Product ID and Size
            const aggregatedMap = new Map<string, { totalQty: number; sizeMap: Map<string, number> }>();
            for (const item of summaries) {
                if (!item.productId) continue;
                if (!aggregatedMap.has(item.productId)) {
                    aggregatedMap.set(item.productId, { totalQty: 0, sizeMap: new Map() });
                }
                const entry = aggregatedMap.get(item.productId)!;
                const qty = Number(item.quantity) || 1;
                entry.totalQty += qty;
                if (item.selectedSize) {
                    entry.sizeMap.set(item.selectedSize, (entry.sizeMap.get(item.selectedSize) || 0) + qty);
                }
            }

            const sortedProductIds = Array.from(aggregatedMap.keys()).sort(); // 🔒 Deterministic ASC Clustered-PK Order
            const lockedProductMap = new Map<string, Product>();

            // 2. Sequential Clustered-PK Row Locks in strict ASC order
            for (const productId of sortedProductIds) {
                const lockedProduct = await queryRunner.manager.findOne(Product, {
                    where: { id: productId, isDeleted: false },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!lockedProduct) return false;
                lockedProductMap.set(productId, lockedProduct);
            }

            // 3. Verify availability for all items
            for (const productId of sortedProductIds) {
                const product = lockedProductMap.get(productId)!;
                const req = aggregatedMap.get(productId)!;

                if (product.quantity !== null && product.quantity !== undefined && Number(product.quantity || 0) < req.totalQty) {
                    return false;
                }
                if (product.sizeStock && typeof product.sizeStock === 'object') {
                    for (const [sizeName, neededQty] of req.sizeMap.entries()) {
                        const currentSizeStock = Number(product.sizeStock[sizeName]) || 0;
                        if (currentSizeStock < neededQty) {
                            return false;
                        }
                    }
                }
            }

            // 4. Deduct stock atomically in same sorted order
            for (const productId of sortedProductIds) {
                const product = lockedProductMap.get(productId)!;
                const req = aggregatedMap.get(productId)!;

                let updatedSizeStock = product.sizeStock;
                if (updatedSizeStock && typeof updatedSizeStock === 'object') {
                    updatedSizeStock = { ...updatedSizeStock };
                    for (const [sizeName, neededQty] of req.sizeMap.entries()) {
                        const currentSizeQty = Number(updatedSizeStock[sizeName]) || 0;
                        updatedSizeStock[sizeName] = Math.max(0, currentSizeQty - neededQty);
                    }
                }
                const newTotalQty = (product.quantity !== null && product.quantity !== undefined)
                    ? Math.max(0, Number(product.quantity || 0) - req.totalQty)
                    : 0;

                await queryRunner.manager.update(Product, product.id, {
                    quantity: newTotalQty,
                    sizeStock: updatedSizeStock
                });
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Inserts an immutable, sanitized payment event with non-NULL cross-source deterministic fingerprint.
     */
    private async recordPaymentEvent(
        queryRunner: any,
        payment: Payments,
        eventType: string,
        source: PaymentEventSource,
        gatewayStatus: string,
        rawPayload?: any
    ): Promise<void> {
        try {
            const fingerprint = EventFingerprintBuilder.build({
                paymentId: payment.id,
                eventType,
                tranId: payment.tranId,
                valId: payment.valId,
                gatewayStatus,
                amount: payment.amount,
                currency: payment.currency
            });

            // Sanitized payload - strip sensitive keys
            const sanitized = { ...(rawPayload || {}) };
            delete sanitized.card_no;
            delete sanitized.store_passwd;
            delete sanitized.verify_sign;
            delete sanitized.verify_key;

            const event = queryRunner.manager.create(PaymentEvents, {
                paymentId: payment.id,
                eventType,
                source,
                providerEventId: rawPayload?.val_id || rawPayload?.bank_tran_id || null,
                eventFingerprint: fingerprint,
                gatewayStatus,
                sanitizedPayload: sanitized
            });

            await queryRunner.manager.save(event);
        } catch (eventErr: any) {
            // If duplicate fingerprint exists, database constraint will safely prevent duplicate insertion
            this.logger.debug(`[Payment Event Record] Duplicate event prevented by constraint: ${eventErr?.message}`);
        }
    }

    /**
     * Handles failed or cancelled attempt.
     */
    async handleFailedAttempt(
        payment: Partial<Payments> & { tranId: string },
        gatewayPayload: any,
        source: PaymentEventSource
    ): Promise<{ orderId?: string; humanOrderId?: string } | void> {
        try {
            const paymentRepo = this.dataSource.getRepository(Payments);
            let paymentRecord: Payments | null = null;
            if (payment.id) {
                paymentRecord = payment as Payments;
            } else if (payment.tranId) {
                paymentRecord = await paymentRepo.findOne({
                    where: { tranId: payment.tranId },
                    relations: ['order']
                });
            }
            if (!paymentRecord) {
                this.logger.warn(`[Handle Failed Attempt] Payment record not found for tranId: ${payment.tranId}`);
                return;
            }

            if (paymentRecord.status === PaymentAttemptStatus.PAID) {
                this.logger.warn(`[Handle Failed Attempt] Payment ${paymentRecord.tranId} is already PAID. Illegal transition to FAILED prevented.`);
                return;
            }

            if (!PaymentStateMachine.canTransition(paymentRecord.status, PaymentAttemptStatus.FAILED)) {
                this.logger.warn(
                    `[Handle Failed Attempt] Transition from ${paymentRecord.status} to FAILED not allowed for tranId: ${paymentRecord.tranId}`
                );
                return;
            }

            paymentRecord.status = PaymentAttemptStatus.FAILED;
            paymentRecord.failureCode = gatewayPayload?.status || 'GATEWAY_DECLINED';
            paymentRecord.failureReason = gatewayPayload?.error || gatewayPayload?.failedreason || 'Payment was declined by gateway/bank';
            await paymentRepo.save(paymentRecord);

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            try {
                await this.recordPaymentEvent(
                    queryRunner,
                    paymentRecord,
                    'PAYMENT_FAILED',
                    source,
                    gatewayPayload?.status || 'FAILED',
                    gatewayPayload
                );
            } finally {
                await queryRunner.release();
            }

            return {
                orderId: paymentRecord.orderId,
                humanOrderId: paymentRecord.order?.orderId
            };
        } catch (err: any) {
            this.logger.error(`[Handle Failed Attempt Error] ${err?.message}`);
        }
    }

    /**
     * Handles customer cancelling payment on gateway page.
     */
    async handleCancelledAttempt(
        tranId: string,
        source: PaymentEventSource,
        payload?: any
    ): Promise<{ orderId?: string; humanOrderId?: string } | void> {
        try {
            const paymentRepo = this.dataSource.getRepository(Payments);
            const payment = await paymentRepo.findOne({
                where: { tranId },
                relations: ['order']
            });
            if (!payment) return;

            if (payment.status === PaymentAttemptStatus.PAID) {
                this.logger.warn(`[Handle Cancelled Attempt] Payment ${payment.tranId} is already PAID. Illegal transition to CANCELLED prevented.`);
                return;
            }

            if (!PaymentStateMachine.canTransition(payment.status, PaymentAttemptStatus.CANCELLED)) {
                this.logger.warn(
                    `[Handle Cancelled Attempt] Transition from ${payment.status} to CANCELLED not allowed for tranId: ${payment.tranId}`
                );
                return;
            }

            payment.status = PaymentAttemptStatus.CANCELLED;
            payment.failureCode = 'USER_CANCELLED';
            payment.failureReason = 'Customer voluntarily cancelled payment on checkout page';
            await paymentRepo.save(payment);

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            try {
                await this.recordPaymentEvent(queryRunner, payment, 'PAYMENT_CANCELLED', source, 'CANCELLED', payload);
            } finally {
                await queryRunner.release();
            }

            return {
                orderId: payment.orderId,
                humanOrderId: payment.order?.orderId
            };
        } catch (err: any) {
            this.logger.error(`[Handle Cancelled Attempt Error] ${err?.message}`);
        }
    }
}
