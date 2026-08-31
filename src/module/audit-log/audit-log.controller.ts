import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import { CONFIG } from '../../utils/config';

@Controller({ path: 'audit-logs', version: CONFIG.API_VERSION })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) {}

    @Get()
    async findAll(@Query() filterDto: AuditLogFilterDto) {
        return await this.auditLogService.findAll(filterDto);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return await this.auditLogService.findOne(id);
    }
}
