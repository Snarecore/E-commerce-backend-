import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IdempotencyStatusEnum {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
}

@Entity('idempotency_keys')
@Index('uq_idempotency_scoped_key', ['userId', 'operation', 'idempotencyKey'], { unique: true })
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 50, default: 'CHECKOUT_ORDER' })
  operation!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ name: 'processing_token', type: 'varchar', length: 36, nullable: true })
  processingToken?: string | null;

  @Column({
    type: 'enum',
    enum: IdempotencyStatusEnum,
    default: IdempotencyStatusEnum.PROCESSING,
  })
  status!: IdempotencyStatusEnum;

  @Column({ name: 'response_status_code', type: 'int', nullable: true })
  responseStatusCode?: number | null;

  @Column({ name: 'response_headers', type: 'json', nullable: true })
  responseHeaders?: Record<string, string> | null;

  @Column({ name: 'response_body', type: 'json', nullable: true })
  responseBody?: any;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
