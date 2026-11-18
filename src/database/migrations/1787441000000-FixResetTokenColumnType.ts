import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `user.resetToken` was a BIGINT in legacy databases, but the app stores a 64-char SHA-256
 * hex digest there. Every forgot-password request failed on write. Pending codes are
 * cleared: they are either legacy plain numbers or unusable, and users can request a new one.
 */
export class FixResetTokenColumnType1787441000000 implements MigrationInterface {
    name = 'FixResetTokenColumnType1787441000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'UPDATE `user` SET `resetToken` = NULL, `resetTokenExpiry` = NULL, `resetAttempts` = 0 WHERE `resetToken` IS NOT NULL'
        );
        await queryRunner.query('ALTER TABLE `user` MODIFY `resetToken` VARCHAR(64) NULL');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Hex digests cannot be stored as BIGINT; drop them before narrowing back.
        await queryRunner.query('UPDATE `user` SET `resetToken` = NULL WHERE `resetToken` IS NOT NULL');
        await queryRunner.query('ALTER TABLE `user` MODIFY `resetToken` BIGINT NULL');
    }
}
