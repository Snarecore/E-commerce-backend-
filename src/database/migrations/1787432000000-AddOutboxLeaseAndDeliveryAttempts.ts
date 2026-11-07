import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxLeaseAndDeliveryAttempts1787432000000 implements MigrationInterface {
    name = 'AddOutboxLeaseAndDeliveryAttempts1787432000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Update payment_outbox_events
        if (await queryRunner.hasTable('payment_outbox_events')) {
            if (!(await queryRunner.hasColumn('payment_outbox_events', 'leaseToken'))) {
                await queryRunner.query(
                    'ALTER TABLE `payment_outbox_events` ADD COLUMN `leaseToken` varchar(255) NULL'
                );
            }
            if (!(await queryRunner.hasColumn('payment_outbox_events', 'leaseExpiresAt'))) {
                await queryRunner.query(
                    'ALTER TABLE `payment_outbox_events` ADD COLUMN `leaseExpiresAt` timestamp NULL'
                );
            }
            if (!(await queryRunner.hasColumn('payment_outbox_events', 'replayCount'))) {
                await queryRunner.query(
                    'ALTER TABLE `payment_outbox_events` ADD COLUMN `replayCount` int NOT NULL DEFAULT 0'
                );
            }
        }

        // 2. Create payment_outbox_delivery_attempts
        if (!(await queryRunner.hasTable('payment_outbox_delivery_attempts'))) {
            await queryRunner.query(`
                CREATE TABLE \`payment_outbox_delivery_attempts\` (
                    \`id\` varchar(36) NOT NULL,
                    \`eventId\` varchar(36) NOT NULL,
                    \`workerId\` varchar(150) NOT NULL,
                    \`leaseToken\` varchar(255) NOT NULL,
                    \`status\` varchar(50) NOT NULL DEFAULT 'PROCESSING',
                    \`failureReason\` text NULL,
                    \`startedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`completedAt\` timestamp(6) NULL,
                    INDEX \`IDX_outbox_attempt_event\` (\`eventId\`, \`startedAt\`),
                    INDEX \`IDX_outbox_attempt_worker\` (\`workerId\`, \`startedAt\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }

        // 3. Add composite index on orders for expiry candidate scan
        if (await queryRunner.hasTable('orders')) {
            try {
                await queryRunner.query(`
                    CREATE INDEX \`IDX_orders_expiry_scan\` ON \`orders\` (\`status\`, \`paymentStatus\`, \`orderPaymentExpiresAt\`, \`isDeleted\`)
                `);
            } catch {
                // Index might already exist
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('orders')) {
            try {
                await queryRunner.query('DROP INDEX `IDX_orders_expiry_scan` ON `orders`');
            } catch {}
        }
        if (await queryRunner.hasTable('payment_outbox_delivery_attempts')) {
            await queryRunner.query('DROP TABLE `payment_outbox_delivery_attempts`');
        }
        if (await queryRunner.hasTable('payment_outbox_events')) {
            if (await queryRunner.hasColumn('payment_outbox_events', 'replayCount')) {
                await queryRunner.query('ALTER TABLE `payment_outbox_events` DROP COLUMN `replayCount`');
            }
            if (await queryRunner.hasColumn('payment_outbox_events', 'leaseExpiresAt')) {
                await queryRunner.query('ALTER TABLE `payment_outbox_events` DROP COLUMN `leaseExpiresAt`');
            }
            if (await queryRunner.hasColumn('payment_outbox_events', 'leaseToken')) {
                await queryRunner.query('ALTER TABLE `payment_outbox_events` DROP COLUMN `leaseToken`');
            }
        }
    }
}
