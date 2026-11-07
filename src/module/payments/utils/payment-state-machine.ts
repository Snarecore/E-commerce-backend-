import { PaymentAttemptStatus } from '../enums/payment.enum';

export class PaymentStateMachine {
    /**
     * Strict allowed forward transitions for a PaymentAttempt.
     * Note: Once a payment is in PAID state, it can NEVER transition back to any non-paid state.
     * Refunds are managed independently in the PaymentRefunds lifecycle.
     */
    private static readonly ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentAttemptStatus, PaymentAttemptStatus[]> = {
        [PaymentAttemptStatus.PENDING]: [
            PaymentAttemptStatus.PROCESSING,
            PaymentAttemptStatus.PAID,
            PaymentAttemptStatus.FAILED,
            PaymentAttemptStatus.CANCELLED,
            PaymentAttemptStatus.EXPIRED,
            PaymentAttemptStatus.UNKNOWN
        ],
        [PaymentAttemptStatus.PROCESSING]: [
            PaymentAttemptStatus.PAID,
            PaymentAttemptStatus.FAILED,
            PaymentAttemptStatus.CANCELLED,
            PaymentAttemptStatus.UNKNOWN
        ],
        [PaymentAttemptStatus.UNKNOWN]: [
            PaymentAttemptStatus.PAID,
            PaymentAttemptStatus.FAILED,
            PaymentAttemptStatus.CANCELLED,
            PaymentAttemptStatus.PROCESSING
        ],
        // Terminal or Non-Confirmable States:
        [PaymentAttemptStatus.PAID]: [], // 🔒 Immutable financial state.
        [PaymentAttemptStatus.FAILED]: [PaymentAttemptStatus.UNKNOWN],
        [PaymentAttemptStatus.CANCELLED]: [PaymentAttemptStatus.UNKNOWN],
        [PaymentAttemptStatus.EXPIRED]: [PaymentAttemptStatus.UNKNOWN]
    };

    /**
     * Verifies if moving from `currentStatus` to `targetStatus` is permitted.
     */
    static canTransition(currentStatus: PaymentAttemptStatus, targetStatus: PaymentAttemptStatus): boolean {
        if (currentStatus === targetStatus) return true; // Idempotent same-state
        const allowed = this.ALLOWED_PAYMENT_TRANSITIONS[currentStatus] || [];
        return allowed.includes(targetStatus);
    }

    /**
     * Throws an error if an illegal transition is attempted.
     */
    static assertTransition(currentStatus: PaymentAttemptStatus, targetStatus: PaymentAttemptStatus, tranId: string): void {
        if (!this.canTransition(currentStatus, targetStatus)) {
            throw new Error(`[State Machine Violation] Illegal payment transition from "${currentStatus}" to "${targetStatus}" for tranId: "${tranId}"`);
        }
    }
}
