import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  RTO = 'RTO',
}

export enum RiskLevelEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum PolicyDecisionEnum {
  ALLOW = 'ALLOW',
  REVIEW = 'REVIEW',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  BLOCK = 'BLOCK',
}

export enum RiskReviewStatusEnum {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('orders')
@Index('uq_order_user_client_ref', ['userId', 'clientOrderRef'], { unique: true })
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'client_order_ref', type: 'varchar', length: 100 })
  clientOrderRef!: string;

  @Column({ type: 'enum', enum: OrderStatusEnum, default: OrderStatusEnum.PENDING })
  status!: OrderStatusEnum;

  @Column({ name: 'fulfillment_hold', type: 'boolean', default: false })
  fulfillmentHold!: boolean;

  @Column({ name: 'risk_review_status', type: 'enum', enum: RiskReviewStatusEnum, default: RiskReviewStatusEnum.NOT_REQUIRED })
  riskReviewStatus!: RiskReviewStatusEnum;

  @Column({ name: 'risk_score', type: 'int' })
  riskScore!: number;

  @Column({ name: 'risk_level', type: 'enum', enum: RiskLevelEnum })
  riskLevel!: RiskLevelEnum;

  @Column({ name: 'policy_decision', type: 'enum', enum: PolicyDecisionEnum })
  policyDecision!: PolicyDecisionEnum;

  @Column({ name: 'risk_engine_version', type: 'varchar', length: 20, default: 'v3.1.0' })
  riskEngineVersion!: string;

  @Column({ name: 'policy_version', type: 'varchar', length: 30, default: 'risk-policy-2026-09' })
  policyVersion!: string;

  @Column({ name: 'risk_snapshot', type: 'json' })
  riskSnapshot!: {
    level: RiskLevelEnum;
    score: number;
    decision: PolicyDecisionEnum;
    signals: Array<{ code: string; weight: number; classification: string; metadata?: any }>;
    evaluatedAt: string;
    engineVersion: string;
    policyVersion: string;
    phoneHashVersion: number;
    subjectId: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
