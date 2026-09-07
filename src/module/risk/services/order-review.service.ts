import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderEntity, RiskReviewStatusEnum } from '../entity/order.entity';
import { AuditLogEntity } from '../entity/audit-log.entity';

@Injectable()
export class OrderReviewService {
  constructor(private readonly dataSource: DataSource) {}

  async approveRiskReview(orderId: string, adminId: string, reason?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found.');
      }

      if (order.riskReviewStatus !== RiskReviewStatusEnum.PENDING_REVIEW || !order.fulfillmentHold) {
        throw new ConflictException('Order is not currently pending manual risk review.');
      }

      const updateResult = await queryRunner.manager.createQueryBuilder()
        .update(OrderEntity)
        .set({
          riskReviewStatus: RiskReviewStatusEnum.APPROVED,
          fulfillmentHold: false,
        })
        .where('id = :id AND risk_review_status = :pendingStatus AND fulfillment_hold = :hold', {
          id: orderId,
          pendingStatus: RiskReviewStatusEnum.PENDING_REVIEW,
          hold: true,
        })
        .execute();

      if (updateResult.affected === 0) {
        throw new ConflictException('Order review status was modified by another admin or process.');
      }

      const audit = queryRunner.manager.create(AuditLogEntity, {
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'APPROVE_RISK_REVIEW',
        entityType: 'Order',
        entityId: orderId,
        oldValue: { riskReviewStatus: order.riskReviewStatus, fulfillmentHold: order.fulfillmentHold },
        newValue: { riskReviewStatus: RiskReviewStatusEnum.APPROVED, fulfillmentHold: false },
        reason: reason || 'Admin approved manual risk review',
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return { success: true, message: 'Order risk review approved. Fulfillment hold released.' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectRiskReview(orderId: string, adminId: string, reason?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found.');
      }

      if (order.riskReviewStatus !== RiskReviewStatusEnum.PENDING_REVIEW || !order.fulfillmentHold) {
        throw new ConflictException('Order is not currently pending manual risk review.');
      }

      const updateResult = await queryRunner.manager.createQueryBuilder()
        .update(OrderEntity)
        .set({
          riskReviewStatus: RiskReviewStatusEnum.REJECTED,
          fulfillmentHold: true, // Remains on hold if rejected
        })
        .where('id = :id AND risk_review_status = :pendingStatus AND fulfillment_hold = :hold', {
          id: orderId,
          pendingStatus: RiskReviewStatusEnum.PENDING_REVIEW,
          hold: true,
        })
        .execute();

      if (updateResult.affected === 0) {
        throw new ConflictException('Order review status was modified by another admin or process.');
      }

      const audit = queryRunner.manager.create(AuditLogEntity, {
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'REJECT_RISK_REVIEW',
        entityType: 'Order',
        entityId: orderId,
        oldValue: { riskReviewStatus: order.riskReviewStatus, fulfillmentHold: order.fulfillmentHold },
        newValue: { riskReviewStatus: RiskReviewStatusEnum.REJECTED, fulfillmentHold: true },
        reason: reason || 'Admin rejected manual risk review',
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return { success: true, message: 'Order risk review rejected. Fulfillment remains held.' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
