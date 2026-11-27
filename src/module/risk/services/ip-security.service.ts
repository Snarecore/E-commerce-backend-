import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class IpSecurityService {
  isValidIp(ip: string): boolean {
    if (!ip) return false;
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  getCanonicalLockKeys(ip: string): { exactIpKey: string; ancestorLockKey: string; family: 'IPv4' | 'IPv6' } {
    if (ip.includes(':')) {
      const parts = ip.split(':');
      const net48Prefix = parts.slice(0, 3).join(':') + '::/48';
      return {
        exactIpKey: `IP:${ip}`,
        ancestorLockKey: `V6/48:${net48Prefix}`,
        family: 'IPv6',
      };
    } else {
      const octets = ip.split('.');
      const net16Prefix = `${octets[0]}.${octets[1]}.0.0/16`;
      return {
        exactIpKey: `IP:${ip}`,
        ancestorLockKey: `V4/16:${net16Prefix}`,
        family: 'IPv4',
      };
    }
  }

  validateCidrRange(prefixLength: number, family: 'IPv4' | 'IPv6'): void {
    if (family === 'IPv4') {
      if (prefixLength < 16 || prefixLength > 32) {
        throw new BadRequestException('IPv4 CIDR mutation must be between /16 and /32.');
      }
    } else {
      if (prefixLength < 48 || prefixLength > 128) {
        throw new BadRequestException('IPv6 CIDR mutation must be between /48 and /128.');
      }
    }
  }

  checkIpInCidr(ip: string, networkAddress: string, prefixLength: number): boolean {
    if (!this.isValidIp(ip) || !this.isValidIp(networkAddress)) return false;
    if (ip.includes(':') !== networkAddress.includes(':')) return false;

    if (!ip.includes(':')) {
      const ipNum = this.ipv4ToLong(ip);
      const netNum = this.ipv4ToLong(networkAddress);
      const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
      return (ipNum & mask) === (netNum & mask);
    }

    const ipHex = this.ipv6ToHex(ip);
    const netHex = this.ipv6ToHex(networkAddress);
    const charCount = Math.floor(prefixLength / 4);
    return ipHex.substring(0, charCount) === netHex.substring(0, charCount);
  }

  private ipv4ToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  }

  private ipv6ToHex(ip: string): string {
    const parts = ip.split(':');
    return parts.map((p) => p.padStart(4, '0')).join('');
  }
}
