import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BlacklistSubjectTypeEnum {
  PHONE = 'PHONE',
  EXACT_IP = 'EXACT_IP',
  CIDR = 'CIDR',
}

export enum BlacklistSeverityEnum {
  HARD_BLOCK = 'HARD_BLOCK',
  SUSPICIOUS_FLAG = 'SUSPICIOUS_FLAG',
}

export enum BlacklistStatusEnum {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ReasonCodeEnum {
  FRAUD_HISTORY = 'FRAUD_HISTORY',
  MULTIPLE_RTO = 'MULTIPLE_RTO',
  CHARGEBACK = 'CHARGEBACK',
  SUSPICIOUS_IP = 'SUSPICIOUS_IP',
  ADMIN_REQUEST = 'ADMIN_REQUEST',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
}

@Entity('blacklists')
@Index('idx_blacklist_phone_lookup', ['subjectType', 'valueHash', 'status'])
@Index('idx_blacklist_ip_lookup', ['subjectType', 'ipAddress', 'status'])
export class BlacklistEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'subject_type', type: 'enum', enum: BlacklistSubjectTypeEnum })
  subjectType!: BlacklistSubjectTypeEnum;

  @Column({ name: 'value_hash', type: 'varchar', length: 64, nullable: true })
  valueHash?: string | null;

  @Column({ name: 'display_value', type: 'varchar', length: 100, nullable: true })
  displayValue?: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 100, nullable: true })
  customerName?: string | null;

  @Column({ name: 'customer_email', type: 'varchar', length: 100, nullable: true })
  customerEmail?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'address_family', type: 'varchar', length: 10, nullable: true })
  addressFamily?: 'IPv4' | 'IPv6' | null;

  @Column({ name: 'network_address', type: 'varchar', length: 45, nullable: true })
  networkAddress?: string | null;

  @Column({ name: 'prefix_length', type: 'tinyint', nullable: true })
  prefixLength?: number | null;

  @Column({ name: 'hash_version', type: 'tinyint', default: 1 })
  hashVersion!: number;

  @Column({ type: 'enum', enum: BlacklistSeverityEnum })
  severity!: BlacklistSeverityEnum;

  @Column({ name: 'reason_code', type: 'enum', enum: ReasonCodeEnum, default: ReasonCodeEnum.ADMIN_REQUEST })
  reasonCode!: ReasonCodeEnum;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'created_by_admin_id', type: 'varchar', length: 36, nullable: true })
  createdByAdminId?: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'ADMIN' })
  actorType!: 'ADMIN' | 'SYSTEM';

  @Column({ type: 'enum', enum: BlacklistStatusEnum, default: BlacklistStatusEnum.ACTIVE })
  status!: BlacklistStatusEnum;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
