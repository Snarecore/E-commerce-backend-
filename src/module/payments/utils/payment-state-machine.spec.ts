import { PaymentAttemptStatus } from '../enums/payment.enum';
import { PaymentStateMachine } from './payment-state-machine';

describe('PaymentStateMachine', () => {
    describe('canTransition', () => {
        it('should allow valid transitions from PENDING', () => {
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PAID)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.FAILED)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.CANCELLED)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.EXPIRED)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.UNKNOWN)).toBe(true);
        });

        it('should allow valid transitions from PROCESSING', () => {
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.PAID)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.FAILED)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.CANCELLED)).toBe(true);
        });

        it('should allow valid transitions from UNKNOWN to PAID or FAILED', () => {
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.UNKNOWN, PaymentAttemptStatus.PAID)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.UNKNOWN, PaymentAttemptStatus.FAILED)).toBe(true);
        });

        it('should forbid transitions from PAID to any non-PAID state', () => {
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.FAILED)).toBe(false);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.CANCELLED)).toBe(false);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.PENDING)).toBe(false);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.EXPIRED)).toBe(false);
        });

        it('should allow same-status transition (idempotency)', () => {
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.PAID)).toBe(true);
            expect(PaymentStateMachine.canTransition(PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PENDING)).toBe(true);
        });
    });

    describe('assertTransition', () => {
        it('should throw an error for illegal transition from PAID to FAILED', () => {
            expect(() => {
                PaymentStateMachine.assertTransition(PaymentAttemptStatus.PAID, PaymentAttemptStatus.FAILED, 'TRAN-123');
            }).toThrow('[State Machine Violation]');
        });

        it('should not throw for valid transition from PROCESSING to PAID', () => {
            expect(() => {
                PaymentStateMachine.assertTransition(PaymentAttemptStatus.PROCESSING, PaymentAttemptStatus.PAID, 'TRAN-123');
            }).not.toThrow();
        });
    });
});
