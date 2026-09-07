import { Injectable } from '@nestjs/common';
import { CustomerRiskSubjectEntity } from '../entity/customer-risk-subject.entity';
import { RiskLevelEnum } from '../entity/order.entity';

export interface IRiskSignal {
  code: string;
  weight: number;
  classification: 'HARD_SIGNAL' | 'SOFT_SIGNAL' | 'CONTEXT_SIGNAL';
  metadata?: any;
}

export interface IRiskEvaluationResult {
  score: number;
  level: RiskLevelEnum;
  signals: IRiskSignal[];
  engineVersion: string;
}

@Injectable()
export class RiskEngineService {
  readonly ENGINE_VERSION = 'v3.1.0';

  evaluate(params: { isIpFlagged: boolean; riskSubject?: CustomerRiskSubjectEntity | null }): IRiskEvaluationResult {
    const signals: IRiskSignal[] = [];
    let rawScore = 0;

    if (params.isIpFlagged) {
      signals.push({
        code: 'SUSPICIOUS_IP_FLAG',
        weight: 40,
        classification: 'SOFT_SIGNAL',
      });
      rawScore += 40;
    }

    if (params.riskSubject) {
      if (params.riskSubject.returnedOrders >= 2) {
        signals.push({
          code: 'HIGH_RTO_HISTORY',
          weight: 50,
          classification: 'SOFT_SIGNAL',
          metadata: { returnedOrders: params.riskSubject.returnedOrders },
        });
        rawScore += 50;
      }

      if (params.riskSubject.totalOrders === 0) {
        signals.push({
          code: 'FIRST_TIME_ORDER',
          weight: 10,
          classification: 'CONTEXT_SIGNAL',
        });
        rawScore += 10;
      }
    }

    const score = Math.min(100, Math.max(0, rawScore));
    const level = this.calculateLevel(score);

    return {
      score,
      level,
      signals,
      engineVersion: this.ENGINE_VERSION,
    };
  }

  private calculateLevel(score: number): RiskLevelEnum {
    if (score >= 70) return RiskLevelEnum.CRITICAL;
    if (score >= 50) return RiskLevelEnum.HIGH;
    if (score >= 30) return RiskLevelEnum.MEDIUM;
    return RiskLevelEnum.LOW;
  }
}
