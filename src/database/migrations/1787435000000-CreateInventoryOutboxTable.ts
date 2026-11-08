import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryOutboxTable1787435000000 implements MigrationInterface {
    name = 'CreateInventoryOutboxTable1787435000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('inventory_outbox_events'))) {
            await queryRunner.query(`
                CREATE TABLE \`inventory_outbox_events\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`aggregateType\` varchar(50) NOT NULL,
                    \`aggregateId\` varchar(255) NOT NULL,
                    \`eventType\` varchar(100) NOT NULL,
                    \`payload\` json NOT NULL,
                    \`status\` enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
                    \`retryCount\` int NOT NULL DEFAULT 0,
                    \`leaseToken\` varchar(255) NULL,
                    \`leaseExpiresAt\` timestamp NULL,
                    \`nextAttemptAt\` timestamp NULL,
                    \`publishedAt\` timestamp NULL,
                    \`failureReason\` text NULL,
                    INDEX \`IDX_inventory_outbox_processing\` (\`status\`, \`nextAttemptAt\`, \`leaseExpiresAt\`),
                    INDEX \`IDX_inventory_outbox_aggregate\` (\`aggregateType\`, \`aggregateId\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`inventory_outbox_events\``);
    }
}
