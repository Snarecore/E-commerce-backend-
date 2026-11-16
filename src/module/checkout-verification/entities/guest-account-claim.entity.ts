import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';

export enum GuestClaimStatus {
    ISSUED = 'ISSUED',
    CONSUMED = 'CONSUMED',
    EXPIRED = 'EXPIRED'
}

@Entity('guest_account_claims')
@Index('IDX_claim_token_hash_unique', ['tokenHash'], { unique: true })
@Index('IDX_claim_orderId', ['orderId'])
@Index('IDX_claim_phone', ['phone'])
export class GuestAccountClaim extends AbstractEntity {
    @Column({ type: 'varchar', length: 64, nullable: false })
    orderId: string;

    @Column({ type: 'varchar', length: 20, nullable: false })
    phone: string; // Canonical E.164 (+8801XXXXXXXXX)

    @Column({ type: 'varchar', length: 64, nullable: false, unique: true })
    tokenHash: string; // SHA-256 of opaque token secret

    @Column({ type: 'enum', enum: GuestClaimStatus, default: GuestClaimStatus.ISSUED })
    status: GuestClaimStatus;

    @Column({ type: 'timestamp', nullable: false })
    expiresAt: Date; // Default: 24h

    @Column({ type: 'timestamp', nullable: true })
    consumedAt: Date;
}
