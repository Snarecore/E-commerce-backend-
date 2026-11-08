import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockAdjustmentTables1787434000000 implements MigrationInterface {
    name = 'CreateStockAdjustmentTables1787434000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create stock_adjustments table
        if (!(await queryRunner.hasTable('stock_adjustments'))) {
            await queryRunner.query(`
                CREATE TABLE \`stock_adjustments\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`adjustmentNumber\` varchar(50) NOT NULL,
                    \`status\` enum('DRAFT', 'PENDING_APPROVAL', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
                    \`reason\` enum('ADDITION', 'DAMAGED', 'LOST', 'THEFT', 'AUDIT_SURPLUS', 'AUDIT_DEFICIT', 'SAMPLE_GIFT', 'OTHER') NOT NULL DEFAULT 'OTHER',
                    \`mode\` enum('ADDITION', 'SUBTRACTION', 'EXACT_COUNT') NOT NULL DEFAULT 'SUBTRACTION',
                    \`notes\` text NULL,
                    \`attachmentUrl\` varchar(500) NULL,
                    \`totalItemsAdjusted\` int NOT NULL DEFAULT 0,
                    \`totalValueImpact\` decimal(12,2) NOT NULL DEFAULT 0.00,
                    \`createdByUserId\` varchar(36) NULL,
                    \`createdByName\` varchar(255) NULL,
                    \`approvedByUserId\` varchar(36) NULL,
                    \`approvedByName\` varchar(255) NULL,
                    \`approvedAt\` timestamp NULL,
                    UNIQUE KEY \`UQ_adjustment_number\` (\`adjustmentNumber\`),
                    INDEX \`IDX_adjustment_status\` (\`status\`),
                    INDEX \`IDX_adjustment_date\` (\`createdAt\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }

        // 2. Create stock_adjustment_items table
        if (!(await queryRunner.hasTable('stock_adjustment_items'))) {
            await queryRunner.query(`
                CREATE TABLE \`stock_adjustment_items\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`adjustmentId\` varchar(36) NOT NULL,
                    \`productId\` varchar(36) NOT NULL,
                    \`productName\` varchar(255) NOT NULL,
                    \`sku\` varchar(100) NULL,
                    \`size\` varchar(50) NULL,
                    \`previousStock\` int NOT NULL DEFAULT 0,
                    \`adjustedQuantity\` int NOT NULL,
                    \`newStock\` int NOT NULL DEFAULT 0,
                    \`unitCost\` decimal(10,2) NOT NULL DEFAULT 0.00,
                    \`subtotalImpact\` decimal(10,2) NOT NULL DEFAULT 0.00,
                    INDEX \`IDX_adj_item_adjustment\` (\`adjustmentId\`),
                    INDEX \`IDX_adj_item_product\` (\`productId\`),
                    CONSTRAINT \`FK_adj_item_adjustment\` FOREIGN KEY (\`adjustmentId\`) REFERENCES \`stock_adjustments\` (\`id\`) ON DELETE CASCADE,
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('stock_adjustment_items')) {
            await queryRunner.query('DROP TABLE `stock_adjustment_items`');
        }
        if (await queryRunner.hasTable('stock_adjustments')) {
            await queryRunner.query('DROP TABLE `stock_adjustments`');
        }
    }
}
