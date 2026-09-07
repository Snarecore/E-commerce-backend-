import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  BlacklistEntity,
  BlacklistSubjectTypeEnum,
  BlacklistSeverityEnum,
  BlacklistStatusEnum,
  ReasonCodeEnum,
} from '../entity/blacklist.entity';
import { AuditLogEntity } from '../entity/audit-log.entity';
import { RiskSubjectLockEntity } from '../entity/risk-subject-lock.entity';
import { IpSecurityService } from './ip-security.service';

@Injectable()
export class BlacklistService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ipSecurity: IpSecurityService,
  ) {}

  async checkIsHardBlockedInTx(
    queryRunner: QueryRunner,
    value: string,
    type: 'phone' | 'ip'
  ): Promise<boolean> {
    const now = new Date();
    if (type === 'phone') {
      const entry = await queryRunner.manager.findOne(BlacklistEntity, {
        where: {
          subjectType: BlacklistSubjectTypeEnum.PHONE,
          valueHash: value,
          severity: BlacklistSeverityEnum.HARD_BLOCK,
          status: BlacklistStatusEnum.ACTIVE,
        },
      });
      if (entry && (!entry.expiresAt || entry.expiresAt > now)) {
        return true;
      }
      return false;
    } else {
      const activeIpEntries = await queryRunner.manager.find(BlacklistEntity, {
        where: [
          {
            subjectType: BlacklistSubjectTypeEnum.EXACT_IP,
            ipAddress: value,
            severity: BlacklistSeverityEnum.HARD_BLOCK,
            status: BlacklistStatusEnum.ACTIVE,
          },
          {
            subjectType: BlacklistSubjectTypeEnum.CIDR,
            severity: BlacklistSeverityEnum.HARD_BLOCK,
            status: BlacklistStatusEnum.ACTIVE,
          },
        ],
      });

      for (const entry of activeIpEntries) {
        if (entry.expiresAt && entry.expiresAt <= now) continue;
        if (entry.subjectType === BlacklistSubjectTypeEnum.EXACT_IP) return true;
        if (
          entry.subjectType === BlacklistSubjectTypeEnum.CIDR &&
          entry.networkAddress &&
          entry.prefixLength
        ) {
          if (this.ipSecurity.checkIpInCidr(value, entry.networkAddress, entry.prefixLength)) {
            return true;
          }
        }
      }
      return false;
    }
  }

  async checkIsSuspiciousInTx(queryRunner: QueryRunner, ip: string, _type: 'ip' = 'ip'): Promise<boolean> {
    const now = new Date();
    const activeEntries = await queryRunner.manager.find(BlacklistEntity, {
      where: [
        {
          subjectType: BlacklistSubjectTypeEnum.EXACT_IP,
          ipAddress: ip,
          severity: BlacklistSeverityEnum.SUSPICIOUS_FLAG,
          status: BlacklistStatusEnum.ACTIVE,
        },
        {
          subjectType: BlacklistSubjectTypeEnum.CIDR,
          severity: BlacklistSeverityEnum.SUSPICIOUS_FLAG,
          status: BlacklistStatusEnum.ACTIVE,
        },
      ],
    });

    for (const entry of activeEntries) {
      if (entry.expiresAt && entry.expiresAt <= now) continue;
      if (entry.subjectType === BlacklistSubjectTypeEnum.EXACT_IP) return true;
      if (
        entry.subjectType === BlacklistSubjectTypeEnum.CIDR &&
        entry.networkAddress &&
        entry.prefixLength
      ) {
        if (this.ipSecurity.checkIpInCidr(ip, entry.networkAddress, entry.prefixLength)) {
          return true;
        }
      }
    }
    return false;
  }

  async createBlacklistWithAudit(params: {
    subjectType: BlacklistSubjectTypeEnum;
    valueHash?: string;
    ipAddress?: string;
    networkAddress?: string;
    prefixLength?: number;
    severity: BlacklistSeverityEnum;
    reasonCode: ReasonCodeEnum;
    note?: string;
    adminId: string;
    expiresAt?: Date | null;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      let ancestorLockKey = '';
      if (params.subjectType === BlacklistSubjectTypeEnum.PHONE) {
        if (!params.valueHash) throw new UnprocessableEntityException('valueHash is required for PHONE blacklist.');
        ancestorLockKey = `PHONE:${params.valueHash}`;
      } else if (params.subjectType === BlacklistSubjectTypeEnum.EXACT_IP) {
        if (!params.ipAddress) throw new UnprocessableEntityException('ipAddress is required for EXACT_IP blacklist.');
        const keys = this.ipSecurity.getCanonicalLockKeys(params.ipAddress);
        ancestorLockKey = keys.ancestorLockKey;
      } else if (params.subjectType === BlacklistSubjectTypeEnum.CIDR) {
        if (!params.networkAddress || !params.prefixLength) {
          throw new UnprocessableEntityException('networkAddress and prefixLength are required for CIDR blacklist.');
        }
        const family = params.networkAddress.includes(':') ? 'IPv6' : 'IPv4';
        this.ipSecurity.validateCidrRange(params.prefixLength, family);
        const keys = this.ipSecurity.getCanonicalLockKeys(params.networkAddress);
        ancestorLockKey = keys.ancestorLockKey;
      }

      if (ancestorLockKey) {
        await queryRunner.query(
          `INSERT INTO risk_subject_locks (lock_key, subject_type, created_at)
           VALUES (?, 'SUBNET_V4', NOW())
           ON DUPLICATE KEY UPDATE lock_key = lock_key`,
          [ancestorLockKey]
        );
        await queryRunner.manager.findOne(RiskSubjectLockEntity, {
          where: { lockKey: ancestorLockKey },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const entity = queryRunner.manager.create(BlacklistEntity, {
        ...params,
        status: BlacklistStatusEnum.ACTIVE,
        createdByAdminId: params.adminId,
        actorType: 'ADMIN',
      });
      const saved = await queryRunner.manager.save(entity);

      const audit = queryRunner.manager.create(AuditLogEntity, {
        actorId: params.adminId,
        actorType: 'ADMIN',
        action: 'CREATE_BLACKLIST',
        entityType: 'Blacklist',
        entityId: saved.id,
        newValue: saved,
        reason: params.note || params.reasonCode,
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async revokeBlacklistWithAudit(id: string, adminId: string, reason?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const record = await queryRunner.manager.findOne(BlacklistEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) {
        throw new NotFoundException('Blacklist record not found.');
      }
      if (record.status === BlacklistStatusEnum.REVOKED) {
        throw new ConflictException('Blacklist record is already revoked.');
      }

      const oldValue = { ...record };
      record.status = BlacklistStatusEnum.REVOKED;
      const updated = await queryRunner.manager.save(record);

      const audit = queryRunner.manager.create(AuditLogEntity, {
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'REVOKE_BLACKLIST',
        entityType: 'Blacklist',
        entityId: updated.id,
        oldValue,
        newValue: updated,
        reason: reason || 'Admin revoked blacklist entry',
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listBlacklists(query?: { status?: BlacklistStatusEnum; type?: BlacklistSubjectTypeEnum }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.type) where.subjectType = query.type;
    return this.dataSource.getRepository(BlacklistEntity).find({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}
