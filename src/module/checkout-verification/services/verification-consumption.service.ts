import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { CheckoutPhoneVerification, VerificationStatus } from '../entities/checkout-phone-verification.entity';
import { ConsumedVerification } from '../interfaces/verification-provider.interface';
import { normalizeBDPhone } from '../../../utils/phone-normalizer.util';

@Injectable()
export class VerificationConsumptionService {
    private readonly logger = new Logger(VerificationConsumptionService.name);

    /**
     * Atomically consumes a verified phone challenge within an active TypeORM transaction.
     * Enforces phone binding, status checks, and non-expiration.
     * If the verification cannot be claimed, transaction aborts immediately.
     */
    async consumeVerificationInTransaction(
        queryRunner: QueryRunner,
        verificationId: string,
        expectedPhone: string,
        orderId: string
    ): Promise<ConsumedVerification> {
        if (!verificationId) {
            throw new BadRequestException('Verification ID is required to finalize order.');
        }

        const canonicalExpectedPhone = normalizeBDPhone(expectedPhone);

        // Atomic conditional UPDATE query directly inside active transaction
        const now = new Date();
        const updateResult = await queryRunner.manager
            .createQueryBuilder()
            .update(CheckoutPhoneVerification)
            .set({
                status: VerificationStatus.CONSUMED,
                orderId: orderId,
                consumedAt: now
            })
            .where('id = :verificationId', { verificationId })
            .andWhere('phone = :expectedPhone', { expectedPhone: canonicalExpectedPhone })
            .andWhere('status = :verifiedStatus', { verifiedStatus: VerificationStatus.VERIFIED })
            .andWhere('expiresAt > :now', { now })
            .execute();

        if (!updateResult.affected || updateResult.affected === 0) {
            // Investigate exact failure reason to return a precise actionable error
            const record = await queryRunner.manager.findOne(CheckoutPhoneVerification, {
                where: { id: verificationId }
            });

            if (!record) {
                throw new BadRequestException('Checkout phone verification record not found.');
            }

            if (record.phone !== canonicalExpectedPhone) {
                throw new BadRequestException(
                    `Phone number mismatch: Verified phone was "${record.phone}", but order delivery phone is "${canonicalExpectedPhone}".`
                );
            }

            if (record.status === VerificationStatus.CONSUMED) {
                throw new ConflictException(
                    'This phone verification code has already been consumed by another order. Please verify again.'
                );
            }

            if (record.status !== VerificationStatus.VERIFIED) {
                throw new BadRequestException(
                    `Phone verification is not in a valid state (Current state: ${record.status}). Please complete OTP verification.`
                );
            }

            if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
                throw new BadRequestException(
                    'Phone verification has expired. Please verify your phone number again.'
                );
            }

            throw new BadRequestException('Failed to consume phone verification challenge.');
        }

        // Fetch consumed record to provide authoritative snapshot data to the order
        const consumedRecord = await queryRunner.manager.findOne(CheckoutPhoneVerification, {
            where: { id: verificationId }
        });

        this.logger.log(
            `[CHALLENGE CONSUMED] ID=${verificationId} OrderID=${orderId} Phone=${canonicalExpectedPhone}`
        );

        return {
            verificationId: consumedRecord!.id,
            phone: consumedRecord!.phone,
            provider: consumedRecord!.provider,
            verifiedAt: consumedRecord!.verifiedAt || new Date(),
            orderId: consumedRecord!.orderId || orderId
        };
    }
}
