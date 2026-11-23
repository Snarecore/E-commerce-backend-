import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIncompleteCheckoutTables1795447146618 implements MigrationInterface {
    name = 'CreateIncompleteCheckoutTables1795447146618';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('incomplete_checkouts'))) {
            await queryRunner.query(`
                CREATE TABLE \`incomplete_checkouts\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint NOT NULL DEFAULT 0,
                    \`publicCheckoutId\` varchar(32) NOT NULL,
                    \`sessionTokenHash\` varchar(64) NOT NULL,
                    \`customerId\` varchar(36) NULL,
                    \`customerName\` varchar(150) NULL,
                    \`customerPhone\` varchar(20) NULL,
                    \`customerEmail\` varchar(150) NULL,
                    \`shippingAddress\` text NULL,
                    \`shippingCity\` varchar(100) NULL,
                    \`cartItemsSnapshot\` json NOT NULL,
                    \`currency\` varchar(3) NOT NULL DEFAULT 'BDT',
                    \`subtotalMinor\` bigint UNSIGNED NOT NULL DEFAULT '0',
                    \`deliveryFeeMinor\` bigint UNSIGNED NOT NULL DEFAULT '0',
                    \`discountMinor\` bigint UNSIGNED NOT NULL DEFAULT '0',
                    \`totalMinor\` bigint UNSIGNED NOT NULL DEFAULT '0',
                    \`source\` varchar(255) NOT NULL DEFAULT 'Website checkout',
                    \`utmParams\` json NULL,
                    \`status\` enum ('active', 'abandoned', 'converted', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
                    \`convertedOrderId\` varchar(36) NULL,
                    \`recoveryAttemptCount\` int UNSIGNED NOT NULL DEFAULT '0',
                    \`version\` int NOT NULL DEFAULT 1,
                    \`startedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`lastActivityAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`abandonedAt\` timestamp(6) NULL,
                    \`convertedAt\` timestamp(6) NULL,
                    \`cancelledAt\` timestamp(6) NULL,
                    \`expiresAt\` timestamp(6) NOT NULL,
                    INDEX \`IDX_incomplete_checkouts_expires\` (\`expiresAt\`),
                    INDEX \`IDX_incomplete_checkouts_convertedOrder\` (\`convertedOrderId\`),
                    INDEX \`IDX_incomplete_checkouts_customer\` (\`customerId\`),
                    INDEX \`IDX_incomplete_checkouts_status_createdAt\` (\`status\`, \`createdAt\`),
                    INDEX \`IDX_incomplete_checkouts_status_lastActivity\` (\`status\`, \`lastActivityAt\`),
                    UNIQUE INDEX \`IDX_incomplete_checkouts_publicCheckoutId\` (\`publicCheckoutId\`),
                    UNIQUE INDEX \`IDX_incomplete_checkouts_sessionTokenHash\` (\`sessionTokenHash\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            await queryRunner.query(`
                ALTER TABLE \`incomplete_checkouts\`
                ADD CONSTRAINT \`FK_incomplete_checkouts_customer\`
                FOREIGN KEY (\`customerId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION;
            `);

            await queryRunner.query(`
                ALTER TABLE \`incomplete_checkouts\`
                ADD CONSTRAINT \`FK_incomplete_checkouts_order\`
                FOREIGN KEY (\`convertedOrderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION;
            `);
        }

        if (!(await queryRunner.hasTable('checkout_recovery_activities'))) {
            await queryRunner.query(`
                CREATE TABLE \`checkout_recovery_activities\` (
                    \`id\` varchar(36) NOT NULL,
                    \`checkoutId\` varchar(36) NOT NULL,
                    \`adminId\` varchar(36) NULL,
                    \`action\` enum ('call_initiated', 'whatsapp_opened', 'note_added', 'converted', 'cancelled') NOT NULL,
                    \`note\` text NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX \`IDX_recovery_activities_admin\` (\`adminId\`),
                    INDEX \`IDX_recovery_activities_checkout_created\` (\`checkoutId\`, \`createdAt\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            await queryRunner.query(`
                ALTER TABLE \`checkout_recovery_activities\`
                ADD CONSTRAINT \`FK_recovery_activities_checkout\`
                FOREIGN KEY (\`checkoutId\`) REFERENCES \`incomplete_checkouts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION;
            `);

            await queryRunner.query(`
                ALTER TABLE \`checkout_recovery_activities\`
                ADD CONSTRAINT \`FK_recovery_activities_admin\`
                FOREIGN KEY (\`adminId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('checkout_recovery_activities')) {
            await queryRunner.query(`DROP TABLE \`checkout_recovery_activities\``);
        }
        if (await queryRunner.hasTable('incomplete_checkouts')) {
            await queryRunner.query(`DROP TABLE \`incomplete_checkouts\``);
        }
    }
}
