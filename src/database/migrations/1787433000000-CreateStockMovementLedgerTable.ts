import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockMovementLedgerTable1787433000000 implements MigrationInterface {
    name = 'CreateStockMovementLedgerTable1787433000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('stock_movements'))) {
            await queryRunner.query(`
                CREATE TABLE \`stock_movements\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                    \`productId\` varchar(36) NOT NULL,
                    \`variantId\` varchar(36) NULL,
                    \`size\` varchar(50) NULL,
                    \`sku\` varchar(100) NULL,
                    \`movementType\` enum(
                        'OPENING',
                        'SALE_RESERVED',
                        'SALE_DISPATCH',
                        'SALE_CANCEL_RELEASE',
                        'ADJUSTMENT_ADDITION',
                        'ADJUSTMENT_DAMAGE',
                        'ADJUSTMENT_LOST',
                        'ADJUSTMENT_THEFT',
                        'ADJUSTMENT_SURPLUS',
                        'ADJUSTMENT_DEFICIT',
                        'ADJUSTMENT_SAMPLE',
                        'RETURN_RESTOCK',
                        'EXCHANGE_SWAP',
                        'MANUAL_CORRECTION'
                    ) NOT NULL,
                    \`quantityChange\` int NOT NULL,
                    \`onHandBefore\` int NOT NULL DEFAULT 0,
                    \`onHandAfter\` int NOT NULL DEFAULT 0,
                    \`reservedBefore\` int NOT NULL DEFAULT 0,
                    \`reservedAfter\` int NOT NULL DEFAULT 0,
                    \`availableBefore\` int NOT NULL DEFAULT 0,
                    \`availableAfter\` int NOT NULL DEFAULT 0,
                    \`referenceType\` enum(
                        'ORDER',
                        'STOCK_ADJUSTMENT',
                        'RETURN',
                        'EXCHANGE',
                        'OPENING',
                        'MANUAL'
                    ) NOT NULL,
                    \`referenceId\` varchar(255) NULL,
                    \`idempotencyKey\` varchar(255) NULL,
                    \`reason\` varchar(255) NULL,
                    \`note\` text NULL,
                    \`performedBy\` varchar(255) NULL,
                    \`performedByName\` varchar(255) NULL,
                    INDEX \`IDX_stock_movement_product_created\` (\`productId\`, \`createdAt\`),
                    INDEX \`IDX_stock_movement_ref\` (\`referenceType\`, \`referenceId\`),
                    INDEX \`IDX_stock_movement_type\` (\`movementType\`, \`createdAt\`),
                    INDEX \`IDX_stock_movement_idempotency\` (\`idempotencyKey\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('stock_movements')) {
            await queryRunner.query('DROP TABLE `stock_movements`');
        }
    }
}
