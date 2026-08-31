import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuditAction } from '../constants/audit-action.enum';
import { AuditModule } from '../constants/audit-module.enum';
import { AuditTargetType } from '../constants/audit-target-type.enum';

export class AuditLogFilterDto {
    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(AuditModule)
    module?: AuditModule;

    @IsOptional()
    @IsEnum(AuditAction)
    action?: AuditAction;

    @IsOptional()
    @IsEnum(AuditTargetType)
    targetType?: AuditTargetType;

    @IsOptional()
    @IsString()
    status?: 'SUCCESS' | 'FAILED';

    @IsOptional()
    @IsString()
    actorId?: string;

    @IsOptional()
    fromDate?: string;

    @IsOptional()
    toDate?: string;
}
