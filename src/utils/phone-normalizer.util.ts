import { BadRequestException } from '@nestjs/common';

/**
 * Strict Bangladeshi Mobile Phone Number Normalizer.
 * Enforces E.164 canonical standard (+8801[3-9]XXXXXXXX).
 * Handles prefixes: +880, 880, 0, or bare 1[3-9]XXXXXXXX.
 * Strips whitespace, dashes, and special formatting characters.
 */
export function normalizeBDPhone(rawPhone: string): string {
    if (!rawPhone || typeof rawPhone !== 'string') {
        throw new BadRequestException('Phone number is required.');
    }

    // Strip whitespaces, dashes, parentheses
    const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();

    // Bangladeshi Mobile Operator Pattern:
    // Country code: +880 / 880 / 0
    // Mobile operator: 13, 14, 15, 16, 17, 18, 19
    // Subscriber number: 8 digits
    const bdRegex = /^(?:\+?880|0)?(1[3-9]\d{8})$/;
    const match = cleaned.match(bdRegex);

    if (!match || !match[1]) {
        throw new BadRequestException(
            `Invalid Bangladeshi mobile phone number: "${rawPhone}". Must be a valid 11-digit mobile number starting with 013-019.`
        );
    }

    return `+880${match[1]}`;
}

/**
 * Validates if the phone number is a valid BD mobile number without throwing.
 */
export function isValidBDPhone(rawPhone: string): boolean {
    try {
        normalizeBDPhone(rawPhone);
        return true;
    } catch {
        return false;
    }
}
