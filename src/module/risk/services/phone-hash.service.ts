import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

export interface IPhoneHashTuple {
  hash: string;
  version: number;
}

@Injectable()
export class PhoneHashService {
  private readonly secretV1: string;
  private readonly secretV2: string;

  constructor() {
    this.secretV1 = process.env.PHONE_HMAC_SECRET_V1 || 'default_secret_v1_change_in_prod';
    this.secretV2 = process.env.PHONE_HMAC_SECRET_V2 || 'default_secret_v2_change_in_prod';
  }

  normalizeE164(rawPhone: string): string {
    if (!rawPhone) return '';
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('880')) {
      digits = digits.substring(3);
    }
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    return `+880${digits}`;
  }

  hashWithVersion(canonicalPhone: string, version: number = 1): string {
    const secret = version === 2 ? this.secretV2 : this.secretV1;
    return crypto.createHmac('sha256', secret).update(canonicalPhone).digest('hex');
  }

  normalizeAndHash(rawPhone: string): { canonicalE164: string; hash: string; hashVersion: number } {
    const canonicalE164 = this.normalizeE164(rawPhone);
    const hash = this.hashWithVersion(canonicalE164, 1);
    return { canonicalE164, hash, hashVersion: 1 };
  }

  getAllLookupHashes(canonicalPhone: string): IPhoneHashTuple[] {
    return [
      { hash: this.hashWithVersion(canonicalPhone, 1), version: 1 },
      { hash: this.hashWithVersion(canonicalPhone, 2), version: 2 },
    ];
  }
}
