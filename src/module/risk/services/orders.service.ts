import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { OrderEntity, OrderStatusEnum, PolicyDecisionEnum, RiskReviewStatusEnum } from '../entity/order.entity';
import { CustomerRiskSubjectEntity, CustomerRiskPhoneHashEntity } from '../entity/customer-risk-subject.entity';
import { IdempotencyKeyEntity, IdempotencyStatusEnum } from '../entity/idempotency-key.entity';
import { RiskSubjectLockEntity } from '../entity/risk-subject-lock.entity';
import { OutboxEventEntity, OutboxStatusEnum } from '../entity/outbox-event.entity';
import { RiskEngineService } from './risk-engine.service';
import { PolicyEngineService } from './policy-engine.service';
import { BlacklistService } from './blacklist.service';
import { PhoneHashService } from './phone-hash.service';
import { IpSecurityService } from './ip-security.service';
import { CreateOrderDto } from '../dto/create-order.dto';

export type IdempotencyTxAction = 'CLAIMED' | 'REPLAY' | 'CONFLICT';

export interface ICheckoutTxResult {
  action: IdempotencyTxAction | 'SUCCESS' | 'REJECTED';
  statusCode: number;
  data: any;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly riskEngine: RiskEngineService,
    private readonly policyEngine: PolicyEngineService,
    private readonly blacklistService: BlacklistService,
    private readonly phoneHashService: PhoneHashService,
    private readonly ipSecurity: IpSecurityService,
  ) {}

  async checkout(params: {
    dto: CreateOrderDto;
    rawPhone: string;
    clientIp: string;
    userId: string;
    idempotencyKey: string;
  }) {
    const { canonicalE164, hash: phoneHmac, hashVersion } = this.phoneHashService.normalizeAndHash(params.rawPhone);
    const lookupHashes = this.phoneHashService.getAllLookupHashes(canonicalE164);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(params.dto)).digest('hex');

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        const result = await this.executeCheckoutTransaction({
          ...params,
          phoneHmac,
          hashVersion,
          lookupHashes,
          requestHash,
        });

        if (result.action === 'CONFLICT') {
          throw new ConflictException(result.data?.message || 'Request payload or idempotency conflict.');
        }
        if (result.action === 'REJECTED') {
          throw new ForbiddenException(result.data?.message || 'Order placement is restricted due to risk policy.');
        }
        if (result.action === 'REPLAY' || result.action === 'SUCCESS') {
          return result;
        }
      } catch (error: any) {
        if (attempt < MAX_RETRIES && this.isMySQLRetryableError(error)) {
          const jitter = Math.floor(Math.random() * 50);
          const backoff = 50 * Math.pow(2, attempt - 1) + jitter;
          this.logger.warn(`MySQL deadlock on attempt ${attempt}. Retrying in ${backoff}ms...`);
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException('Checkout transaction failed after maximum retries.');
  }

  private async executeCheckoutTransaction(params: {
    dto: CreateOrderDto;
    phoneHmac: string;
    hashVersion: number;
    lookupHashes: Array<{ hash: string; version: number }>;
    clientIp: string;
    userId: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<ICheckoutTxResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    const processingToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      // 1. Claim or Replay Idempotency Row
      const idempotencyResult = await this.claimIdempotencyInTx(
        queryRunner,
        params.userId,
        params.idempotencyKey,
        params.requestHash,
        processingToken,
        expiresAt
      );

      if (idempotencyResult.action !== 'CLAIMED') {
        await queryRunner.commitTransaction();
        return idempotencyResult;
      }

      // 2. Deterministic Ancestor Shared Lock Acquisition
      const { exactIpKey, ancestorLockKey } = this.ipSecurity.getCanonicalLockKeys(params.clientIp);
      const phoneLockKey = `PHONE:${params.phoneHmac}`;
      const sortedLockKeys = Array.from(new Set([exactIpKey, ancestorLockKey, phoneLockKey])).sort();

      for (const lockKey of sortedLockKeys) {
        await queryRunner.query(
          `INSERT INTO risk_subject_locks (lock_key, subject_type, created_at)
           VALUES (?, 'EXACT_IP', NOW())
           ON DUPLICATE KEY UPDATE lock_key = lock_key`,
          [lockKey]
        );
        await queryRunner.manager.findOne(RiskSubjectLockEntity, {
          where: { lockKey },
          lock: { mode: 'pessimistic_write' },
        });
      }

      // 3. Multi-Version Phone Hash Resolution & Integrity Check
      const subject = await this.resolveOrMapSubjectInTx(
        queryRunner,
        params.lookupHashes,
        params.phoneHmac,
        params.hashVersion
      );

      // 4. In-Tx Blacklist & CIDR Re-check
      const isPhoneBlocked = await this.blacklistService.checkIsHardBlockedInTx(queryRunner, params.phoneHmac, 'phone');
      const isIpBlocked = await this.blacklistService.checkIsHardBlockedInTx(queryRunner, params.clientIp, 'ip');

      if (isPhoneBlocked || isIpBlocked) {
        const blockBody = { success: false, error: 'ORDER_RESTRICTED', message: 'Order placement restricted.' };
        await this.completeIdempotencyInTx(queryRunner, params.userId, params.idempotencyKey, processingToken, 403, blockBody);
        await queryRunner.commitTransaction();
        return { action: 'REJECTED', statusCode: 403, data: blockBody };
      }

      const isIpFlagged = await this.blacklistService.checkIsSuspiciousInTx(queryRunner, params.clientIp, 'ip');

      // 5. Evaluate Risk & Policy Engines
      const risk = this.riskEngine.evaluate({ isIpFlagged, riskSubject: subject });
      const policy = this.policyEngine.decide({ score: risk.score, signals: risk.signals });

      if (policy.decision === PolicyDecisionEnum.BLOCK) {
        const riskBody = { success: false, error: 'FRAUD_RESTRICTED', message: 'Order rejected due to risk policy.' };
        await this.completeIdempotencyInTx(queryRunner, params.userId, params.idempotencyKey, processingToken, 403, riskBody);
        await queryRunner.commitTransaction();
        return { action: 'REJECTED', statusCode: 403, data: riskBody };
      }

      const fulfillmentHold = policy.decision === PolicyDecisionEnum.MANUAL_REVIEW;
      const riskReviewStatus = fulfillmentHold ? RiskReviewStatusEnum.PENDING_REVIEW : RiskReviewStatusEnum.NOT_REQUIRED;

      // 6. Insert Order Record
      const order = queryRunner.manager.create(OrderEntity, {
        userId: params.userId,
        clientOrderRef: params.dto.clientOrderRef,
        status: OrderStatusEnum.PENDING,
        fulfillmentHold,
        riskReviewStatus,
        riskScore: risk.score,
        riskLevel: risk.level,
        policyDecision: policy.decision,
        riskEngineVersion: risk.engineVersion,
        policyVersion: policy.policyVersion,
        riskSnapshot: {
          level: risk.level,
          score: risk.score,
          decision: policy.decision,
          signals: risk.signals,
          evaluatedAt: new Date().toISOString(),
          engineVersion: risk.engineVersion,
          policyVersion: policy.policyVersion,
          phoneHashVersion: params.hashVersion,
          subjectId: subject.id,
        },
      });
      const savedOrder = await queryRunner.manager.save(order);

      // 7. Increment Profile Counters
      subject.totalOrders += 1;
      subject.lastOrderAt = new Date();
      await queryRunner.manager.save(subject);

      // 8. Complete Idempotency Row (201 Created)
      const successBody = { success: true, data: savedOrder };
      await this.completeIdempotencyInTx(queryRunner, params.userId, params.idempotencyKey, processingToken, 201, successBody);

      // 9. Insert Transactional Outbox Event
      const outbox = queryRunner.manager.create(OutboxEventEntity, {
        eventKey: `ORDER_CREATED:${savedOrder.id}`,
        eventType: 'ORDER_CREATED',
        aggregateType: 'Order',
        aggregateId: savedOrder.id,
        payload: { orderId: savedOrder.id, userId: params.userId, riskLevel: risk.level },
        status: OutboxStatusEnum.PENDING,
        availableAt: new Date(),
      });
      await queryRunner.manager.save(outbox);

      await queryRunner.commitTransaction();
      return { action: 'SUCCESS', statusCode: 201, data: successBody };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async resolveOrMapSubjectInTx(
    queryRunner: QueryRunner,
    lookupHashes: Array<{ hash: string; version: number }>,
    currentHash: string,
    currentVersion: number
  ): Promise<CustomerRiskSubjectEntity> {
    const hashStrings = lookupHashes.map((h) => h.hash);

    const existingMappings = await queryRunner.manager
      .createQueryBuilder(CustomerRiskPhoneHashEntity, 'ph')
      .innerJoinAndSelect('ph.subject', 'subject')
      .where('ph.phoneHash IN (:...hashStrings)', { hashStrings })
      .getMany();

    if (existingMappings.length > 0) {
      const distinctSubjectIds = new Set(existingMappings.map((m: CustomerRiskPhoneHashEntity) => m.subjectId));
      if (distinctSubjectIds.size > 1) {
        throw new InternalServerErrorException('Risk subject integrity violation: Multiple subjects mapped across hashes.');
      }

      const subject = existingMappings[0].subject;
      const hasCurrentMapping = existingMappings.some((m: CustomerRiskPhoneHashEntity) => m.phoneHash === currentHash);

      if (!hasCurrentMapping) {
        const newMapping = queryRunner.manager.create(CustomerRiskPhoneHashEntity, {
          phoneHash: currentHash,
          hashVersion: currentVersion,
          subjectId: subject.id,
        });
        await queryRunner.manager.save(newMapping);
      }

      return (await queryRunner.manager.findOne(CustomerRiskSubjectEntity, {
        where: { id: subject.id },
        lock: { mode: 'pessimistic_write' },
      }))!;
    }

    const newSubject = queryRunner.manager.create(CustomerRiskSubjectEntity, { totalOrders: 0 });
    const savedSubject = await queryRunner.manager.save(newSubject);

    const newMapping = queryRunner.manager.create(CustomerRiskPhoneHashEntity, {
      phoneHash: currentHash,
      hashVersion: currentVersion,
      subjectId: savedSubject.id,
    });
    await queryRunner.manager.save(newMapping);

    return savedSubject;
  }

  private async claimIdempotencyInTx(
    queryRunner: QueryRunner,
    userId: string,
    key: string,
    requestHash: string,
    token: string,
    expiresAt: Date
  ): Promise<ICheckoutTxResult> {
    await queryRunner.query(
      `INSERT INTO idempotency_keys (id, user_id, operation, idempotency_key, request_hash, processing_token, status, expires_at, created_at, updated_at)
       VALUES (UUID(), ?, 'CHECKOUT_ORDER', ?, ?, ?, 'PROCESSING', ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [userId, key, requestHash, token, expiresAt]
    );

    const record = await queryRunner.manager.findOne(IdempotencyKeyEntity, {
      where: { userId, operation: 'CHECKOUT_ORDER', idempotencyKey: key },
      lock: { mode: 'pessimistic_write' },
    });

    if (!record) {
      throw new InternalServerErrorException('Failed to lock or claim idempotency record.');
    }

    if (record.requestHash && record.requestHash !== requestHash) {
      return { action: 'CONFLICT', statusCode: 409, data: { message: 'Idempotency key payload hash mismatch.' } };
    }

    if (record.status === IdempotencyStatusEnum.COMPLETED) {
      return { action: 'REPLAY', statusCode: record.responseStatusCode || 200, data: record.responseBody };
    }

    if (record.status === IdempotencyStatusEnum.PROCESSING && record.expiresAt > new Date() && record.processingToken !== token) {
      return { action: 'CONFLICT', statusCode: 409, data: { message: 'Request is currently processing.' } };
    }

    record.processingToken = token;
    record.status = IdempotencyStatusEnum.PROCESSING;
    await queryRunner.manager.save(record);

    return { action: 'CLAIMED', statusCode: 200, data: null };
  }

  private async completeIdempotencyInTx(
    queryRunner: QueryRunner,
    userId: string,
    key: string,
    token: string,
    statusCode: number,
    body: any
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE idempotency_keys
       SET status = 'COMPLETED',
           response_status_code = ?,
           response_body = ?,
           response_headers = ?,
           processing_token = NULL,
           updated_at = NOW()
       WHERE user_id = ? AND operation = 'CHECKOUT_ORDER' AND idempotency_key = ? AND processing_token = ?`,
      [statusCode, JSON.stringify(body), JSON.stringify({ 'content-type': 'application/json' }), userId, key, token]
    );
  }

  private isMySQLRetryableError(error: any): boolean {
    return error?.code === 'ER_LOCK_DEADLOCK' || error?.errno === 1213 || error?.code === 'ER_LOCK_WAIT_TIMEOUT';
  }
}
