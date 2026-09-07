import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('risk_subject_locks')
export class RiskSubjectLockEntity {
  @PrimaryColumn({ name: 'lock_key', type: 'varchar', length: 100 })
  lockKey!: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 20 })
  subjectType!: 'PHONE' | 'EXACT_IP' | 'SUBNET_V4' | 'SUBNET_V6';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
