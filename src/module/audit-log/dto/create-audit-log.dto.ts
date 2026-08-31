import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { AuditAction } from '../constants/audit-action.enum';
import { AuditModule } from '../constants/audit-module.enum';
import { AuditTargetType } from '../constants/audit-target-type.enum';
import { AuditChange } from '../audit-log.types';

export class CreateAuditLogDto {
    @IsOptional()
    @IsString()
    actorId?: string | null;

    @IsOptional()
    @IsString()
    actorName?: string | null;

    @IsOptional()
    @IsString()
    actorEmail?: string | null;

    @IsOptional()
    @IsString()
    actorRole?: string | null;

    @IsEnum(AuditAction)
    action: AuditAction;

    @IsEnum(AuditModule)
    module: AuditModule;

    @IsOptional()
    @IsString()
    targetId?: string | null;

    @IsOptional()
    @IsEnum(AuditTargetType)
    targetType?: AuditTargetType | null;

    @IsOptional()
    @IsString()
    httpMethod?: string | null;

    @IsOptional()
    @IsString()
    route?: string | null;

    @IsOptional()
    @IsInt()
    statusCode?: number | null;

    @IsOptional()
    @IsInt()
    durationMs?: number | null;

    @IsOptional()
    @IsString()
    ipAddress?: string | null;

    @IsOptional()
    @IsString()
    userAgent?: string | null;

    @IsOptional()
    changes?: AuditChange | null;

    @IsOptional()
    @IsString()
    status?: 'SUCCESS' | 'FAILED';
}
