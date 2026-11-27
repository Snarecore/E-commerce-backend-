import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Password rules for every place a password is chosen (NIST 800-63B: length over composition). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** An email address, trimmed and lower-cased so the same mailbox is always the same account. */
export function NormalizedEmail(): PropertyDecorator {
    return applyDecorators(
        Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
        IsEmail({}, { message: 'Please enter a valid email address.' }),
        MaxLength(254)
    );
}

/** A newly chosen password. Not used on login, where any stored password must still work. */
export function NewPassword(): PropertyDecorator {
    return applyDecorators(
        IsString(),
        MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` }),
        MaxLength(PASSWORD_MAX_LENGTH, { message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` })
    );
}
