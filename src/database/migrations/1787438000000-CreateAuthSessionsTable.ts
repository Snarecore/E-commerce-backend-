import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessionsTable1787438000000 implements MigrationInterface {
    name = 'CreateAuthSessionsTable1787438000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('auth_sessions'))) {
            await queryRunner.query(`
                CREATE TABLE \`auth_sessions\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`userId\` varchar(36) NOT NULL,
                    \`tokenHash\` char(64) NOT NULL,
                    \`expiresAt\` timestamp NOT NULL,
                    \`revokedAt\` timestamp NULL,
                    \`revokedReason\` varchar(32) NULL,
                    \`replacedById\` varchar(36) NULL,
                    \`ipAddress\` varchar(64) NULL,
                    \`userAgent\` varchar(512) NULL,
                    PRIMARY KEY (\`id\`),
                    INDEX \`IDX_auth_sessions_userId\` (\`userId\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`auth_sessions\``);
    }
}
