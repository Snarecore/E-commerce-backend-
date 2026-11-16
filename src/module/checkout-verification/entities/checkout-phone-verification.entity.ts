import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';

export enum VerificationStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    CONSUMED = 'CONSUMED',
    EXPIRED = 'EXPIRED'
}

export enum VerificationProviderType {
    FIREBASE = 'FIREBASE',
    BULKSMS = 'BULKSMS',
    DIRECT = 'DIRECT',
    MOCK = 'MOCK'
}

@Entity('checkout_phone_verifications')
@Index('IDX_phone_created', ['phone', 'createdAt'])
@Index('IDX_proof_fingerprint_unique', ['proofFingerprint'], { unique: true })
@Index('IDX_status_expires', ['status', 'expiresAt'])
@Index('IDX_checkout_verif_orderId', ['orderId'])
export class CheckoutPhoneVerification extends AbstractEntity {
    @Column({ type: 'varchar', length: 20, nullable: false })
    phone: string; // Canonical E.164 (+8801XXXXXXXXX)

    @Column({ type: 'varchar', length: 32, default: VerificationProviderType.DIRECT })
    provider: string;

    @Column({ type: 'varchar', length: 128, nullable: true })
    firebaseUid: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    proofFingerprint: string | null; // sha256(uid:auth_time:phone) to prevent refreshed token replay

    @Column({ type: 'varchar', length: 64, nullable: true })
    otpCodeHash: string | null; // Peppered HMAC-SHA256 for BulkSMS

    @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
    status: VerificationStatus;

    @Column({ type: 'int', default: 0 })
    attemptCount: number;

    @Column({ type: 'timestamp', nullable: false })
    expiresAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    consumedAt: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    orderId: string | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    clientIp: string | null;
}
