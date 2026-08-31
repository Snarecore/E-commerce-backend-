import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../database/abstract.entity';
import { AuditAction } from '../constants/audit-action.enum';
import { AuditModule } from '../constants/audit-module.enum';
import { AuditTargetType } from '../constants/audit-target-type.enum';
import { AuditChange } from '../audit-log.types';

@Entity('audit_logs')
@Index('IDX_audit_created_module', ['createdAt', 'module'])
@Index('IDX_audit_created_action', ['createdAt', 'action'])
@Index('IDX_audit_actor_created', ['actorId', 'createdAt'])
@Index('IDX_audit_target', ['targetType', 'targetId'])
export class AuditLog extends AbstractEntity {
    @Column({ type: 'uuid', nullable: true })
    actorId: string | null;

    @Column({ type: 'varchar', nullable: true })
    actorName: string | null;

    @Column({ type: 'varchar', nullable: true })
    actorEmail: string | null;

    @Column({ type: 'varchar', nullable: true })
    actorRole: string | null;

    @Column({ type: 'varchar', nullable: false })
    action: AuditAction;

    @Column({ type: 'varchar', nullable: false })
    module: AuditModule;

    @Column({ type: 'varchar', nullable: true })
    targetId: string | null;

    @Column({ type: 'varchar', nullable: true })
    targetType: AuditTargetType | null;

    @Column({ type: 'varchar', nullable: true })
    httpMethod: string | null;

    @Column({ type: 'varchar', nullable: true })
    route: string | null;

    @Column({ type: 'int', nullable: true })
    statusCode: number | null;

    @Column({ type: 'int', nullable: true })
    durationMs: number | null;

    @Column({ type: 'varchar', nullable: true })
    ipAddress: string | null;

    @Column({ type: 'text', nullable: true })
    userAgent: string | null;

    @Column({ type: 'json', nullable: true })
    changes: AuditChange | null;

    @Column({ type: 'varchar', default: 'SUCCESS' })
    status: 'SUCCESS' | 'FAILED';
}
