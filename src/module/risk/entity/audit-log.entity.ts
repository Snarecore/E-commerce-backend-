import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index('idx_audit_actor', ['actorId', 'createdAt'])
@Index('idx_audit_entity', ['entityType', 'entityId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'varchar', length: 36 })
  actorId!: string;

  @Column({ name: 'actor_type', type: 'varchar', length: 25, default: 'ADMIN' })
  actorType!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId!: string;

  @Column({ name: 'old_value', type: 'json', nullable: true })
  oldValue?: any;

  @Column({ name: 'new_value', type: 'json', nullable: true })
  newValue?: any;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 36, nullable: true })
  requestId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
