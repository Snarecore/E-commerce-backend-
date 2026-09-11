import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlacklistEntity } from './entity/blacklist.entity';
import { AuditLogEntity } from './entity/audit-log.entity';
import { RiskSubjectLockEntity } from './entity/risk-subject-lock.entity';
import { BlacklistService } from './services/blacklist.service';
import { IpSecurityService } from './services/ip-security.service';
import { PhoneHashService } from './services/phone-hash.service';
import { BlacklistController } from './blacklist.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlacklistEntity,
      AuditLogEntity,
      RiskSubjectLockEntity,
    ]),
  ],
  controllers: [BlacklistController],
  providers: [BlacklistService, IpSecurityService, PhoneHashService],
  exports: [BlacklistService, IpSecurityService, PhoneHashService],
})
export class RiskModule {}
