import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('customer_risk_subjects')
export class CustomerRiskSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'total_orders', type: 'int', default: 0 })
  totalOrders!: number;

  @Column({ name: 'successful_orders', type: 'int', default: 0 })
  successfulOrders!: number;

  @Column({ name: 'returned_orders', type: 'int', default: 0 })
  returnedOrders!: number;

  @Column({ name: 'cancelled_orders', type: 'int', default: 0 })
  cancelledOrders!: number;

  @Column({ name: 'rejected_orders', type: 'int', default: 0 })
  rejectedOrders!: number;

  @Column({ name: 'calculated_risk_score', type: 'int', default: 0 })
  calculatedRiskScore!: number;

  @Column({ name: 'risk_level', type: 'varchar', length: 20, default: 'LOW' })
  riskLevel!: string;

  @Column({ name: 'last_order_at', type: 'datetime', nullable: true })
  lastOrderAt?: Date | null;

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('customer_risk_phone_hashes')
export class CustomerRiskPhoneHashEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_phone_hash_unique', { unique: true })
  @Column({ name: 'phone_hash', type: 'varchar', length: 64, unique: true })
  phoneHash!: string;

  @Column({ name: 'hash_version', type: 'tinyint', default: 1 })
  hashVersion!: number;

  @ManyToOne(() => CustomerRiskSubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject!: CustomerRiskSubjectEntity;

  @Column({ name: 'subject_id', type: 'varchar', length: 36 })
  subjectId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
