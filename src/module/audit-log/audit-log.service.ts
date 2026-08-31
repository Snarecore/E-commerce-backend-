import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditSanitizer } from './audit-log.sanitizer';
import { ResponseUtils, ApiResponse } from '../../utils/response.utils';

@Injectable()
export class AuditLogService implements OnModuleInit {
    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepository: Repository<AuditLog>,
        private readonly dataSource: DataSource
    ) {}

    async onModuleInit() {
        try {
            await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS \`audit_logs\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint NOT NULL DEFAULT 0,
                    \`actorId\` varchar(36) NULL,
                    \`actorName\` varchar(255) NULL,
                    \`actorEmail\` varchar(255) NULL,
                    \`actorRole\` varchar(255) NULL,
                    \`action\` varchar(255) NOT NULL,
                    \`module\` varchar(255) NOT NULL,
                    \`targetId\` varchar(255) NULL,
                    \`targetType\` varchar(255) NULL,
                    \`httpMethod\` varchar(255) NULL,
                    \`route\` varchar(255) NULL,
                    \`statusCode\` int NULL,
                    \`durationMs\` int NULL,
                    \`ipAddress\` varchar(255) NULL,
                    \`userAgent\` text NULL,
                    \`changes\` json NULL,
                    \`status\` varchar(255) NOT NULL DEFAULT 'SUCCESS',
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
        } catch (e) {
            console.error('Auto-creating audit_logs table failed:', e);
        }
    }

    /**
     * Write transactional audit log inside an ongoing TypeORM query runner/entityManager
     */
    async createTransactionalLog(
        entityManager: EntityManager,
        dto: CreateAuditLogDto
    ): Promise<AuditLog> {
        const sanitizedChanges = dto.changes ? AuditSanitizer.sanitize(dto.changes) : null;
        const logEntity = entityManager.create(AuditLog, {
            ...dto,
            changes: sanitizedChanges,
            status: dto.status || 'SUCCESS'
        });
        return await entityManager.save(AuditLog, logEntity);
    }

    /**
     * Write async audit log without blocking request/response flow
     */
    async createAsyncLog(dto: CreateAuditLogDto): Promise<AuditLog | null> {
        try {
            const sanitizedChanges = dto.changes ? AuditSanitizer.sanitize(dto.changes) : null;
            const logEntity = this.auditLogRepository.create({
                ...dto,
                changes: sanitizedChanges,
                status: dto.status || 'SUCCESS'
            });
            return await this.auditLogRepository.save(logEntity);
        } catch (error) {
            console.error('Failed to create async audit log:', error);
            return null;
        }
    }

    /**
     * SQL-level paginated query for Audit Logs
     */
    async findAll(
        dto: AuditLogFilterDto
    ): Promise<ApiResponse<{ data: AuditLog[]; total: number; page: number; limit: number; pageCount: number }>> {
        const page = dto.page ? Math.max(1, Number(dto.page)) : 1;
        const limit = dto.limit ? Math.max(1, Math.min(100, Number(dto.limit))) : 20;
        const skip = (page - 1) * limit;

        const qb = this.auditLogRepository.createQueryBuilder('log')
            .where('log.isDeleted = false');

        if (dto.search && dto.search.trim()) {
            const searchKeyword = `%${dto.search.trim()}%`;
            qb.andWhere(
                '(log.actorName LIKE :search OR log.actorEmail LIKE :search OR log.ipAddress LIKE :search OR log.targetId LIKE :search)',
                { search: searchKeyword }
            );
        }

        if (dto.module) {
            qb.andWhere('log.module = :module', { module: dto.module });
        }

        if (dto.action) {
            qb.andWhere('log.action = :action', { action: dto.action });
        }

        if (dto.targetType) {
            qb.andWhere('log.targetType = :targetType', { targetType: dto.targetType });
        }

        if (dto.status) {
            qb.andWhere('log.status = :status', { status: dto.status });
        }

        if (dto.actorId) {
            qb.andWhere('log.actorId = :actorId', { actorId: dto.actorId });
        }

        if (dto.fromDate) {
            qb.andWhere('log.createdAt >= :fromDate', { fromDate: new Date(dto.fromDate) });
        }

        if (dto.toDate) {
            qb.andWhere('log.createdAt <= :toDate', { toDate: new Date(dto.toDate) });
        }

        qb.orderBy('log.createdAt', 'DESC');
        qb.skip(skip).take(limit);

        const [data, total] = await qb.getManyAndCount();
        const pageCount = Math.ceil(total / limit);

        const payload = {
            data,
            total,
            page,
            limit,
            pageCount
        };

        return ResponseUtils.successResponseHandler(200, 'Audit logs retrieved successfully.', 'data', payload);
    }

    async findOne(id: string): Promise<ApiResponse<AuditLog>> {
        const log = await this.auditLogRepository.findOne({ where: { id, isDeleted: false } });
        if (!log) {
            return ResponseUtils.errorResponseHandler(404, 'Audit log entry not found.');
        }
        return ResponseUtils.successResponseHandler(200, 'Audit log details retrieved successfully.', 'data', log);
    }
}
