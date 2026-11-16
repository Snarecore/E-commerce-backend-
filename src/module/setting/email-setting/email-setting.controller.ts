import { Body, Controller, Get, Post, Req, UseGuards, Optional } from '@nestjs/common';
import { Request } from 'express';
import { CONFIG } from '../../../utils/config';
import { ApiResponse, ResponseUtils } from '../../../utils/response.utils';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { RolesGuard } from '../../../guards/role.guard';
import { Roles } from '../../../decorators/role.decorator';
import { Role } from '../../../enums/role.enum';
import { EmailSettingService } from './email-setting.service';
import { UpdateEmailSettingDto } from './dto/update-email-setting.dto';
import { TestEmailSettingDto } from './dto/test-email-setting.dto';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/constants/audit-action.enum';
import { AuditModule } from '../../audit-log/constants/audit-module.enum';
import { AuditTargetType } from '../../audit-log/constants/audit-target-type.enum';

@Controller({ path: 'email-setting', version: CONFIG.API_VERSION })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmailSettingController {
    constructor(
        private readonly service: EmailSettingService,
        @Optional() private readonly auditLogService?: AuditLogService
    ) {}

    @Get()
    async getSetting(): Promise<ApiResponse<any>> {
        const result = await this.service.getSetting();
        return ResponseUtils.successResponseHandler(200, 'Email settings retrieved successfully.', 'data', result);
    }

    @Post()
    async saveSetting(
        @Body() dto: UpdateEmailSettingDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const result = await this.service.saveSetting(dto);
        const user = (req as any).user;
        const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');

        if (this.auditLogService) {
            this.auditLogService.createAsyncLog({
                actorId: user?.id,
                actorName: user?.name,
                actorEmail: user?.email,
                actorRole: user?.role || 'ADMIN',
                action: AuditAction.SETTING_UPDATED,
                module: AuditModule.SETTINGS,
                targetType: AuditTargetType.SETTING,
                targetId: result?.id || 'email_settings',
                httpMethod: 'POST',
                route: req.originalUrl,
                ipAddress: clientIp,
                userAgent: req.headers['user-agent'] as string,
                changes: {
                    type: 'SNAPSHOT',
                    before: null,
                    after: {
                        provider: dto.provider,
                        host: dto.host,
                        port: dto.port,
                        emailUser: dto.emailUser,
                        senderName: dto.senderName,
                        senderEmail: dto.senderEmail,
                        isActive: dto.isActive
                    }
                },
                status: 'SUCCESS'
            });
        }

        return ResponseUtils.successResponseHandler(200, 'Email settings saved successfully.', 'data', result);
    }

    @Post('test')
    async testConnection(
        @Body() dto: TestEmailSettingDto,
        @Req() req: Request
    ): Promise<ApiResponse<any>> {
        const result = await this.service.testConnection(dto);
        const user = (req as any).user;
        const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');

        if (this.auditLogService) {
            this.auditLogService.createAsyncLog({
                actorId: user?.id,
                actorName: user?.name,
                actorEmail: user?.email,
                actorRole: user?.role || 'ADMIN',
                action: AuditAction.SETTING_UPDATED,
                module: AuditModule.SETTINGS,
                targetType: AuditTargetType.SETTING,
                targetId: 'email_settings_test',
                httpMethod: 'POST',
                route: req.originalUrl,
                ipAddress: clientIp,
                userAgent: req.headers['user-agent'] as string,
                changes: {
                    type: 'SNAPSHOT',
                    before: null,
                    after: {
                        host: dto.host,
                        testRecipient: dto.testRecipient,
                        result: result.message
                    }
                },
                status: result.success ? 'SUCCESS' : 'FAILED'
            });
        }

        return ResponseUtils.successResponseHandler(200, result.message, 'data', result);
    }
}
