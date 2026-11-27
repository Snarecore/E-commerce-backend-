import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema hardening that the application code now relies on:
 *
 * 1. product.sku UNIQUE — SKUs are generated/validated server-side. Garbage SKUs written by an
 *    old admin bug ("[object Object]", "undefined", empty) are replaced with a stable code first.
 * 2. orders.orderId UNIQUE — two checkouts can never share an order number.
 * 3. unique-code-generator.productCode / orderId UNIQUE — the insert itself reserves a code.
 * 4. stock_movements.idempotencyKey UNIQUE — a retried stock request cannot move stock twice.
 * 5. product.price / cost / discountAmount FLOAT → DECIMAL(12,2) — exact money.
 * 6. user.emailVerifiedAt — existing accounts are grandfathered as verified, so nobody loses
 *    their password; only accounts created from now on start unverified.
 *
 * Each unique index is preceded by a duplicate check that aborts with the offending values,
 * because those rows need a human decision rather than a silent rewrite.
 */
export class HardenIdentifiersAndMoney1795447200000 implements MigrationInterface {
    name = 'HardenIdentifiersAndMoney1795447200000';

    private async indexExists(queryRunner: QueryRunner, table: string, index: string): Promise<boolean> {
        const rows = (await queryRunner.query(
            `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
            [table, index]
        )) as unknown[];
        return rows.length > 0;
    }

    private async assertNoDuplicates(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
        const duplicates = (await queryRunner.query(
            `SELECT \`${column}\` AS value, COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` IS NOT NULL GROUP BY \`${column}\` HAVING COUNT(*) > 1 LIMIT 10`
        )) as Array<{ value: string; n: number }>;
        if (duplicates.length > 0) {
            const sample = duplicates.map((d) => `"${d.value}" ×${d.n}`).join(', ');
            throw new Error(`Cannot make ${table}.${column} unique; duplicate values: ${sample}. Resolve them and rerun.`);
        }
    }

    private async addUniqueIndex(queryRunner: QueryRunner, table: string, column: string, index: string, replaces?: string): Promise<void> {
        await this.assertNoDuplicates(queryRunner, table, column);
        if (replaces && (await this.indexExists(queryRunner, table, replaces))) {
            await queryRunner.query(`DROP INDEX \`${replaces}\` ON \`${table}\``);
        }
        if (!(await this.indexExists(queryRunner, table, index))) {
            await queryRunner.query(`CREATE UNIQUE INDEX \`${index}\` ON \`${table}\` (\`${column}\`)`);
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Product SKUs: replace placeholder values left by an old client bug, then enforce uniqueness
        await queryRunner.query(`
            UPDATE \`product\`
            SET \`sku\` = CONCAT('P', UPPER(LEFT(REPLACE(\`id\`, '-', ''), 11)))
            WHERE \`sku\` IS NULL OR TRIM(\`sku\`) IN ('', '[object Object]', 'undefined', 'null')
        `);
        await this.addUniqueIndex(queryRunner, 'product', 'sku', 'UQ_product_sku');

        // 2–4. Identifier uniqueness
        await this.addUniqueIndex(queryRunner, 'orders', 'orderId', 'UQ_orders_orderId', 'IDX_orders_orderId');
        await this.addUniqueIndex(queryRunner, 'unique-code-generator', 'productCode', 'UQ_ucg_productCode');
        await this.addUniqueIndex(queryRunner, 'unique-code-generator', 'orderId', 'UQ_ucg_orderId');
        await this.addUniqueIndex(queryRunner, 'stock_movements', 'idempotencyKey', 'UQ_stock_movement_idempotency', 'IDX_stock_movement_idempotency');

        // 5. Exact money columns (values are rounded to paisa first so the conversion is lossless)
        await queryRunner.query(`
            UPDATE \`product\`
            SET \`price\` = ROUND(\`price\`, 2), \`cost\` = ROUND(\`cost\`, 2), \`discountAmount\` = ROUND(\`discountAmount\`, 2)
        `);
        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`price\` DECIMAL(12,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`cost\` DECIMAL(12,2) NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`discountAmount\` DECIMAL(12,2) NULL`);

        // 6. Email ownership marker
        const hasColumn = (await queryRunner.query(
            `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'emailVerifiedAt' LIMIT 1`
        )) as unknown[];
        if (hasColumn.length === 0) {
            await queryRunner.query(`ALTER TABLE \`user\` ADD \`emailVerifiedAt\` TIMESTAMP NULL DEFAULT NULL`);
            await queryRunner.query(`UPDATE \`user\` SET \`emailVerifiedAt\` = COALESCE(\`createdAt\`, CURRENT_TIMESTAMP)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`emailVerifiedAt\``);

        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`discountAmount\` FLOAT NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`cost\` FLOAT NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` MODIFY \`price\` FLOAT NOT NULL`);

        await queryRunner.query(`DROP INDEX \`UQ_stock_movement_idempotency\` ON \`stock_movements\``);
        await queryRunner.query(`CREATE INDEX \`IDX_stock_movement_idempotency\` ON \`stock_movements\` (\`idempotencyKey\`)`);
        await queryRunner.query(`DROP INDEX \`UQ_ucg_orderId\` ON \`unique-code-generator\``);
        await queryRunner.query(`DROP INDEX \`UQ_ucg_productCode\` ON \`unique-code-generator\``);
        await queryRunner.query(`DROP INDEX \`UQ_orders_orderId\` ON \`orders\``);
        await queryRunner.query(`CREATE INDEX \`IDX_orders_orderId\` ON \`orders\` (\`orderId\`)`);
        await queryRunner.query(`DROP INDEX \`UQ_product_sku\` ON \`product\``);
        // Replaced placeholder SKUs are not restored: they were invalid data.
    }
}
