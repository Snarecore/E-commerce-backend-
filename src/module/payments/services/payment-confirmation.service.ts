import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Orders } from '../../order/entity/order.entity';
import { Payments } from '../entities/payment.entity';
import { PaymentEvents } from '../entities/payment-event.entity';
import { PaymentAttemptStatus, PaymentEventSource, PaymentMethodType } from '../enums/payment.enum';
import { PaymentStatus } from '../../../enums/order-status.enum';
import { SslcommerzService } from './sslcommerz.service';
import { CurrencyUtils } from '../../../utils/currency.utils';
import { EventFingerprintBuilder } from '../utils/event-fingerprint.builder';
import { PaymentStateMachine } from '../utils/payment-state-machine';
import { PaidOrderApplier } from './paid-order-applier.service';
import { EmailService } from '../../email-service/email-sender.service';

@Injectable()
export class PaymentConfirmationService {
    private readonly logger = new Logger(PaymentConfirmationService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly sslcommerzService: SslcommerzService,
        private readonly paidOrderApplier: PaidOrderApplier,
        @Optional() private readonly emailService?: EmailService
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
        const isCurrencyMatch = (validationData?.currency || '').toUpperCase() === (initialPayment.currency || 'BDT').toUpperCase();

        if (!isAmountMatch || !isCurrencyMatch) {
            const discrepancyType = !isAmountMatch ? 'AMOUNT_MISMATCH' : 'CURRENCY_MISMATCH';
            this.logger.error(
                `[Financial Discrepancy] ${discrepancyType}! Expected: ${initialPayment.amount} ${initialPayment.currency}, Gateway: ${valAmount} ${validationData?.currency} for tranId: ${tranId}, valId: ${valId}. Holding for admin reconciliation.`
            );

            // 🛡️ Do NOT discard captured funds or mark FAILED; flag for immediate admin reconciliation
            const discRunner = this.dataSource.createQueryRunner();
            await discRunner.connect();
            await discRunner.startTransaction();
            try {
                const lockedOrder = await discRunner.manager.findOne(Orders, {
                    where: { id: initialPayment.orderId },
                    lock: { mode: 'pessimistic_write' }
                });
                const lockedPayment = await discRunner.manager.findOne(Payments, {
                    where: { id: initialPayment.id },
                    lock: { mode: 'pessimistic_write' }
                });

                if (lockedPayment) {
                    lockedPayment.status = PaymentAttemptStatus.PROCESSING;
                    lockedPayment.needsAdminReview = true;
                    lockedPayment.adminReviewReason = `PAYMENT_CAPTURED_RECONCILIATION_REQUIRED:${discrepancyType}`;
                    lockedPayment.valId = valId;
                    lockedPayment.bankTranId = validationData.bank_tran_id || null;
                    lockedPayment.cardType = validationData.card_type || null;
                    lockedPayment.maskedAccountNo = validationData.card_no || null;
                    await discRunner.manager.save(lockedPayment);
                }

                if (lockedOrder) {
                    lockedOrder.paymentStatus = PaymentStatus.REVIEW_REQUIRED;
                    await discRunner.manager.save(lockedOrder);
                }

                if (lockedPayment) {
                    await this.recordPaymentEvent(discRunner, lockedPayment, 'PAYMENT_CAPTURED_DISCREPANCY_FLAGGED', source, status, validationData);
                }

                await discRunner.commitTransaction();
            } catch (discErr: any) {
                await discRunner.rollbackTransaction();
                this.logger.error(`[Financial Discrepancy Flagging Failed] ${discErr?.message}`);
            } finally {
                await discRunner.release();
            }

            return {
                success: false,
                message: `Payment captured on gateway but financial discrepancy detected (${discrepancyType}). Scheduled for admin reconciliation.`,
                orderId: initialPayment.orderId,
                humanOrderId,
                paymentStatus: 'REVIEW_REQUIRED'
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

                // Branch 2: Late payment for an attempt that had already expired, failed or been cancelled.
                // The shared policy decides what it means for the order (confirm, revive, or refund).
                if (
                    freshPayment.status === PaymentAttemptStatus.EXPIRED ||
                    freshPayment.status === PaymentAttemptStatus.CANCELLED ||
                    freshPayment.status === PaymentAttemptStatus.FAILED
                ) {
                    this.logger.warn(`[Late Payment Detected] Payment ${freshPayment.id} (${freshPayment.status}) on order ${lockedOrder.orderId} (${lockedOrder.status}).`);
                    Object.assign(freshPayment, this.capturedPaymentFields(validationData, valId));
                    return await this.applyCapturedPayment(queryRunner, lockedOrder, freshPayment, { source, status, validationData, valId, late: true });
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

            // affected === 1: the attempt moved from [PENDING, PROCESSING, UNKNOWN] to PAID
            Object.assign(lockedPayment, this.capturedPaymentFields(validationData, valId));
            return await this.applyCapturedPayment(queryRunner, lockedOrder, lockedPayment, { source, status, validationData, valId, late: false });
        } catch (err: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`[Payment Confirmation Transaction Error] ${err?.message}`, err?.stack);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /** Gateway details recorded on an attempt once SSLCommerz validation confirms the capture. */
    private capturedPaymentFields(validationData: any, valId: string): Partial<Payments> {
        return {
            status: PaymentAttemptStatus.PAID,
            valId,
            bankTranId: validationData.bank_tran_id || null,
            cardType: validationData.card_type || null,
            cardIssuer: validationData.card_issuer || null,
            cardBrand: validationData.card_brand || null,
            maskedAccountNo: validationData.card_no || null,
            paymentMethod: this.mapCardTypeToMethod(validationData.card_type),
            paidAt: new Date(),
        };
    }

    /**
     * Applies a validated capture to its order through the shared PaidOrderApplier (the same
     * rules Stripe uses), records the payment event and commits.
     */
    private async applyCapturedPayment(
        queryRunner: QueryRunner,
        order: Orders,
        payment: Payments,
        ctx: { source: PaymentEventSource; status: string; validationData: any; valId: string; late: boolean }
    ): Promise<{ success: boolean; message: string; orderId: string; humanOrderId: string; paymentStatus: string }> {
        const { outcome, decision } = await this.paidOrderApplier.apply({
            queryRunner,
            order,
            payment,
            gatewayLabel: 'SSLCOMMERZ',
            actor: 'sslcommerz_confirmation',
            note: ctx.late ? 'Late online payment confirmed; order revived.' : 'Order confirmed and paid online.',
            eventDetails: { tranId: payment.tranId, valId: ctx.valId, ...(ctx.late ? { latePayment: true } : {}) },
        });

        const paid = outcome === PaymentStatus.PAID;
        const eventType = paid ? (ctx.late ? 'LATE_PAYMENT_CONFIRMED' : 'PAYMENT_CONFIRMED') : `PAYMENT_REVIEW_${decision.reason}`;
        await this.recordPaymentEvent(queryRunner, payment, eventType, ctx.source, ctx.status, ctx.validationData);
        await queryRunner.commitTransaction();

        this.logger.log(`[Payment Confirmation] tranId ${payment.tranId} on order ${order.orderId}: ${outcome} (${decision.reason ?? decision.action})`);
        return {
            success: true,
            message: paid ? 'Payment confirmed successfully' : `Payment received but needs review (${decision.reason}). A refund has been queued.`,
            orderId: order.id,
            humanOrderId: order.orderId,
            paymentStatus: paid ? 'PAID' : 'REVIEW_REQUIRED',
        };
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
     * Fail/cancel callbacks arrive from the customer's browser with nothing but a `tran_id`, so
     * anyone can send them. Before an attempt is closed, SSLCommerz is asked directly: if the
     * gateway reports a capture (or cannot be reached) the attempt stays open, and the IPN or
     * the reconciliation job settles it from the gateway's authoritative answer instead.
     */
    private async gatewayConfirmsNoCapture(tranId: string): Promise<boolean> {
        try {
            const result = await this.sslcommerzService.queryTransaction(tranId);
            const captured = (result?.element ?? []).some((entry) => ['VALID', 'VALIDATED'].includes(String(entry?.status).toUpperCase()));
            if (captured) {
                this.logger.warn(`[Gateway Check] tranId ${tranId} is captured at SSLCommerz; ignoring fail/cancel callback.`);
                return false;
            }
            return true;
        } catch (err: unknown) {
            this.logger.warn(`[Gateway Check] Could not verify tranId ${tranId} (${err instanceof Error ? err.message : String(err)}); leaving attempt open for reconciliation.`);
            return false;
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

            if (!(await this.gatewayConfirmsNoCapture(paymentRecord.tranId))) {
                return { orderId: paymentRecord.orderId, humanOrderId: paymentRecord.order?.orderId };
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

            if (!(await this.gatewayConfirmsNoCapture(payment.tranId))) {
                return { orderId: payment.orderId, humanOrderId: payment.order?.orderId };
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
