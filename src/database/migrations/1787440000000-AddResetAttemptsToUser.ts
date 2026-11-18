import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Counts wrong password-reset code guesses per account, so a 6-digit code cannot be
 * brute-forced by spreading requests across IPs or server instances.
 */
export class AddResetAttemptsToUser1787440000000 implements MigrationInterface {
    name = 'AddResetAttemptsToUser1787440000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const existing: unknown[] = await queryRunner.query(`
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'resetAttempts'
        `);
        if (existing.length === 0) {
            await queryRunner.query(
                `ALTER TABLE \`user\` ADD \`resetAttempts\` INT NOT NULL DEFAULT 0`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`resetAttempts\``);
    }
}
