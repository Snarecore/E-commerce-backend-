import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OutboxStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity('outbox_events')
@Index('idx_outbox_processing_claim', ['status', 'availableAt'])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_key', type: 'varchar', length: 100, unique: true })
  eventKey!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 50 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 36 })
  aggregateId!: string;

  @Column({ type: 'json' })
  payload!: any;

  @Column({ type: 'enum', enum: OutboxStatusEnum, default: OutboxStatusEnum.PENDING })
  status!: OutboxStatusEnum;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'datetime' })
  availableAt!: Date;

  @Column({ name: 'lease_until', type: 'datetime', nullable: true })
  leaseUntil?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
