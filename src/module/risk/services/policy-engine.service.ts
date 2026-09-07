import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PolicyDecisionEnum } from '../entity/order.entity';
import { IRiskSignal } from './risk-engine.service';

export interface IPolicyDecisionResult {
  decision: PolicyDecisionEnum;
  policyVersion: string;
}

@Injectable()
export class PolicyEngineService {
  readonly POLICY_VERSION = 'risk-policy-2026-09';

  decide(params: { score: number; signals: IRiskSignal[]; isHardBlocked?: boolean }): IPolicyDecisionResult {
    let decision: PolicyDecisionEnum;

    if (params.isHardBlocked || params.score >= 70) {
      decision = PolicyDecisionEnum.BLOCK;
    } else if (params.score >= 50) {
      decision = PolicyDecisionEnum.MANUAL_REVIEW;
    } else if (params.score >= 30) {
      decision = PolicyDecisionEnum.REVIEW;
    } else {
      decision = PolicyDecisionEnum.ALLOW;
    }

    if (decision === PolicyDecisionEnum.BLOCK && !params.isHardBlocked) {
      const hasHardSignal = params.signals.some((s) => s.classification === 'HARD_SIGNAL');
      if (!hasHardSignal) {
        throw new InternalServerErrorException(
          'Invalid risk policy execution: BLOCK decision requires at least one HARD_SIGNAL or explicit hard block.'
        );
      }
    }

    return {
      decision,
      policyVersion: this.POLICY_VERSION,
    };
  }
}
