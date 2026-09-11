import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CONFIG } from '../../utils/config';
import { BlacklistService } from './services/blacklist.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../enums/role.enum';
import {
  BlacklistSubjectTypeEnum,
  BlacklistSeverityEnum,
  ReasonCodeEnum,
} from './entity/blacklist.entity';

import { PhoneHashService } from './services/phone-hash.service';

@Controller({
  path: 'site/blacklist',
  version: CONFIG.API_VERSION,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BlacklistController {
  constructor(
    private readonly blacklistService: BlacklistService,
    private readonly phoneHashService: PhoneHashService,
  ) {}

  @Get()
  async getBlacklist(@Query() query: any) {
    const data = await this.blacklistService.listBlacklists(query);
    return {
      statusCode: 200,
      message: 'Blacklist retrieved successfully',
      data,
    };
  }

  @Post()
  async createBlacklist(
    @Body()
    dto: {
      subjectType: BlacklistSubjectTypeEnum;
      valueHash?: string;
      displayValue?: string;
      ipAddress?: string;
      networkAddress?: string;
      prefixLength?: number;
      severity: BlacklistSeverityEnum;
      reasonCode: ReasonCodeEnum;
      note?: string;
      expiresAt?: Date | null;
    },
    @Req() req: any,
  ) {
    const adminId = req.user?.id || req.user?.userId || 'admin';
    let valueHash = dto.valueHash;

    if (dto.subjectType === BlacklistSubjectTypeEnum.PHONE && (!valueHash || valueHash.length < 32)) {
      const phoneToHash = dto.displayValue || dto.valueHash || '';
      if (phoneToHash) {
        const { hash } = this.phoneHashService.normalizeAndHash(phoneToHash);
        valueHash = hash;
      }
    }

    const result = await this.blacklistService.createBlacklistWithAudit({
      ...dto,
      valueHash,
      adminId,
    });
    return {
      statusCode: 201,
      message: 'Blacklist entry created successfully',
      data: result,
    };
  }

  @Patch(':id')
  async revokeBlacklist(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.id || req.user?.userId || 'admin';
    const result = await this.blacklistService.revokeBlacklistWithAudit(
      id,
      adminId,
      body?.reason,
    );
    return {
      statusCode: 200,
      message: 'Blacklist entry revoked successfully',
      data: result,
    };
  }
}
