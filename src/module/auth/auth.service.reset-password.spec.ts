import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

// firebase-admin pulls in ESM-only `jose`, which Jest cannot load. Reset flow never touches it.
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../../utils/firebase-admin.util', () => ({ ensureFirebaseAdmin: jest.fn() }));

const CODE = '123456';
const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

function setup(opts: { user?: Record<string, unknown> | null; attemptsLeft?: boolean } = {}) {
    const user =
        opts.user === undefined
            ? { id: 'u1', email: 'a@b.com', resetToken: hash(CODE), resetTokenExpiry: new Date(Date.now() + 60_000) }
            : opts.user;
    const execute = jest.fn().mockResolvedValue({ affected: opts.attemptsLeft === false ? 0 : 1 });
    const qb = { update: jest.fn(), set: jest.fn(), where: jest.fn(), execute };
    qb.update.mockReturnValue(qb);
    qb.set.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    const userRepository = {
        findOneByQueryRelation: jest.fn().mockResolvedValue(user),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const authSessionService = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
        userRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        authSessionService as any,
        {} as any
    );
    return { service, userRepository, execute, authSessionService };
}

const dto = (token: string) => ({
    email: 'A@b.com ',
    token,
    newPassword: 'NewPass#123',
    confirmPassword: 'NewPass#123',
});

describe('AuthService.resetPassword', () => {
    it('resets the password with the right code and clears the code and counter', async () => {
        const { service, userRepository, authSessionService } = setup();
        await service.resetPassword(dto(CODE) as any);
        expect(userRepository.update).toHaveBeenCalledWith(
            'u1',
            expect.objectContaining({ resetToken: null, resetTokenExpiry: null, resetAttempts: 0 })
        );
        expect(authSessionService.revokeAllForUser).toHaveBeenCalledWith('u1', 'password_reset');
    });

    it('spends an attempt and rejects a wrong code', async () => {
        const { service, userRepository, execute } = setup();
        await expect(service.resetPassword(dto('000000') as any)).rejects.toThrow(
            'Invalid or expired reset code'
        );
        expect(execute).toHaveBeenCalledTimes(1);
        expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('burns the code once the attempt limit is reached, even for the right code', async () => {
        const { service, userRepository } = setup({ attemptsLeft: false });
        await expect(service.resetPassword(dto(CODE) as any)).rejects.toThrow('Too many incorrect attempts');
        expect(userRepository.update).toHaveBeenCalledWith('u1', { resetToken: null, resetTokenExpiry: null });
    });

    it('does not accept the plain-text code stored in the column', async () => {
        const { service } = setup({
            user: { id: 'u1', resetToken: CODE, resetTokenExpiry: new Date(Date.now() + 60_000) },
        });
        await expect(service.resetPassword(dto(CODE) as any)).rejects.toThrow(BadRequestException);
    });

    it('gives the same answer for an unknown email as for a wrong code', async () => {
        const { service, execute } = setup({ user: null });
        await expect(service.resetPassword(dto(CODE) as any)).rejects.toThrow(
            'Invalid or expired reset code'
        );
        expect(execute).not.toHaveBeenCalled();
    });

    it('rejects an expired code without spending an attempt', async () => {
        const { service, execute } = setup({
            user: { id: 'u1', resetToken: hash(CODE), resetTokenExpiry: new Date(Date.now() - 1) },
        });
        await expect(service.resetPassword(dto(CODE) as any)).rejects.toThrow(
            'Invalid or expired reset code'
        );
        expect(execute).not.toHaveBeenCalled();
    });
});
