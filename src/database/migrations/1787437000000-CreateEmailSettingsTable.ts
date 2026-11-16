import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailSettingsTable1787437000000 implements MigrationInterface {
    name = 'CreateEmailSettingsTable1787437000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('email_settings'))) {
            await queryRunner.query(`
                CREATE TABLE \`email_settings\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`provider\` varchar(32) NOT NULL DEFAULT 'GMAIL',
                    \`host\` varchar(128) NOT NULL DEFAULT 'smtp.gmail.com',
                    \`port\` int NOT NULL DEFAULT 465,
                    \`secure\` tinyint(1) NOT NULL DEFAULT 1,
                    \`emailUser\` varchar(128) NOT NULL,
                    \`emailPass\` text NOT NULL,
                    \`senderName\` varchar(128) NOT NULL DEFAULT 'Fashion Time',
                    \`senderEmail\` varchar(128) NOT NULL,
                    \`replyTo\` varchar(128) NULL,
                    \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`email_settings\``);
    }
}
