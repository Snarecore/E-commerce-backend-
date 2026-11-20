import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Courier shipments (Steadfast first). Additive only: the legacy order courier columns
 * (courierName, trackingId, courierTrackingLink) stay and are kept in sync on dispatch.
 */
export class CreateShipmentTables1787445000000 implements MigrationInterface {
    name = 'CreateShipmentTables1787445000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('shipments'))) {
            await queryRunner.query(`
                CREATE TABLE \`shipments\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint NOT NULL DEFAULT 0,
                    \`orderId\` varchar(36) NOT NULL,
                    \`orderCode\` varchar(64) NOT NULL,
                    \`activeOrderKey\` varchar(36) NULL,
                    \`provider\` varchar(32) NOT NULL,
                    \`invoice\` varchar(64) NOT NULL,
                    \`status\` varchar(40) NOT NULL DEFAULT 'PENDING_DISPATCH',
                    \`providerStatus\` varchar(64) NULL,
                    \`consignmentId\` varchar(64) NULL,
                    \`trackingCode\` varchar(64) NULL,
                    \`trackingUrl\` varchar(512) NULL,
                    \`codAmount\` decimal(10,2) NOT NULL DEFAULT 0,
                    \`codCollectedAmount\` decimal(10,2) NULL,
                    \`courierCharge\` decimal(10,2) NULL,
                    \`codSettledAt\` timestamp NULL,
                    \`codSettlementRef\` varchar(100) NULL,
                    \`recipientName\` varchar(120) NOT NULL,
                    \`recipientPhone\` varchar(20) NOT NULL,
                    \`recipientAddress\` text NOT NULL,
                    \`note\` text NULL,
                    \`attemptCount\` int NOT NULL DEFAULT 0,
                    \`nextAttemptAt\` timestamp NULL,
                    \`leaseToken\` varchar(64) NULL,
                    \`leaseExpiresAt\` timestamp NULL,
                    \`lastError\` text NULL,
                    \`needsAttention\` tinyint NOT NULL DEFAULT 0,
                    \`lastProviderStatusAt\` timestamp NULL,
                    \`lastSyncedAt\` timestamp NULL,
                    \`dispatchedAt\` timestamp NULL,
                    \`deliveredAt\` timestamp NULL,
                    \`requestedByUserId\` varchar(36) NULL,
                    INDEX \`IDX_shipments_dispatch_queue\` (\`status\`, \`nextAttemptAt\`, \`leaseExpiresAt\`),
                    INDEX \`IDX_shipments_order\` (\`orderId\`),
                    INDEX \`IDX_shipments_consignment\` (\`provider\`, \`consignmentId\`),
                    INDEX \`IDX_shipments_attention\` (\`needsAttention\`, \`updatedAt\`),
                    UNIQUE INDEX \`UQ_shipments_provider_invoice\` (\`provider\`, \`invoice\`),
                    UNIQUE INDEX \`UQ_shipments_active_order\` (\`activeOrderKey\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            `);
        }

        if (!(await queryRunner.hasTable('shipment_events'))) {
            await queryRunner.query(`
                CREATE TABLE \`shipment_events\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`shipmentId\` varchar(36) NOT NULL,
                    \`source\` varchar(16) NOT NULL,
                    \`providerStatus\` varchar(64) NULL,
                    \`internalStatus\` varchar(40) NULL,
                    \`message\` text NULL,
                    \`payload\` json NULL,
                    \`dedupeKey\` varchar(64) NOT NULL,
                    \`providerEventAt\` timestamp NULL,
                    INDEX \`IDX_shipment_events_shipment\` (\`shipmentId\`, \`createdAt\`),
                    UNIQUE INDEX \`UQ_shipment_events_dedupe\` (\`dedupeKey\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`shipment_events\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`shipments\``);
    }
}
