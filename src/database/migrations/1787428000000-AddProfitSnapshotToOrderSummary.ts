import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfitSnapshotToOrderSummary1787428000000 implements MigrationInterface {
    name = 'AddProfitSnapshotToOrderSummary1787428000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns if missing
        try {
            await queryRunner.query(`
                ALTER TABLE \`order-summary\`
                ADD COLUMN \`unitCostPrice\` decimal(10,2) NOT NULL DEFAULT '0.00',
                ADD COLUMN \`totalCost\` decimal(10,2) NOT NULL DEFAULT '0.00',
                ADD COLUMN \`costSource\` enum('SNAPSHOT','MIGRATED','UNKNOWN') NOT NULL DEFAULT 'SNAPSHOT',
                ADD COLUMN \`snapshotMainCategoryId\` varchar(255) NULL,
                ADD COLUMN \`snapshotFirstCategoryId\` varchar(255) NULL,
                ADD COLUMN \`snapshotSecondCategoryId\` varchar(255) NULL;
            `);
        } catch (e) {
            // Column might already exist in schema sync
        }

        // Backfill existing order-summary items from product table
        try {
            await queryRunner.query(`
                UPDATE \`order-summary\` os
                LEFT JOIN \`product\` p ON os.productId = p.id
                SET 
                    os.unitCostPrice = IF(p.cost IS NOT NULL AND p.cost > 0, p.cost, 0.00),
                    os.totalCost = IF(p.cost IS NOT NULL AND p.cost > 0, ROUND(p.cost * os.quantity, 2), 0.00),
                    os.costSource = IF(p.cost IS NOT NULL AND p.cost > 0, 'MIGRATED', 'UNKNOWN'),
                    os.snapshotMainCategoryId = p.mainCategoryId,
                    os.snapshotFirstCategoryId = p.firstCategoryId,
                    os.snapshotSecondCategoryId = p.secondCategoryId
                WHERE os.unitCostPrice = 0.00 AND os.costSource = 'SNAPSHOT';
            `);
        } catch (e) {
            console.error('Migration backfill warning:', e);
        }

        // Add indexes
        try {
            await queryRunner.query(`CREATE INDEX \`IDX_order_summary_costSource\` ON \`order-summary\` (\`costSource\`);`);
        } catch (e) {}
        try {
            await queryRunner.query(`CREATE INDEX \`IDX_order_summary_categories\` ON \`order-summary\` (\`snapshotMainCategoryId\`, \`snapshotFirstCategoryId\`);`);
        } catch (e) {}
        try {
            await queryRunner.query(`CREATE INDEX \`IDX_orders_status_created\` ON \`orders\` (\`status\`, \`createdAt\`);`);
        } catch (e) {}
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.query(`DROP INDEX \`IDX_orders_status_created\` ON \`orders\`;`);
        } catch (e) {}
        try {
            await queryRunner.query(`DROP INDEX \`IDX_order_summary_categories\` ON \`order-summary\`;`);
        } catch (e) {}
        try {
            await queryRunner.query(`DROP INDEX \`IDX_order_summary_costSource\` ON \`order-summary\`;`);
        } catch (e) {}
        try {
            await queryRunner.query(`
                ALTER TABLE \`order-summary\`
                DROP COLUMN \`snapshotSecondCategoryId\`,
                DROP COLUMN \`snapshotFirstCategoryId\`,
                DROP COLUMN \`snapshotMainCategoryId\`,
                DROP COLUMN \`costSource\`,
                DROP COLUMN \`totalCost\`,
                DROP COLUMN \`unitCostPrice\`;
            `);
        } catch (e) {}
    }
}
