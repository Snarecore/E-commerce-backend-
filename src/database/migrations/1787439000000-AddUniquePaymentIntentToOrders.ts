import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Stripe PaymentIntent may settle only one order. Fails loudly if existing data already
 * links one intent to several orders, since those rows need a human to reconcile them.
 */
export class AddUniquePaymentIntentToOrders1787439000000 implements MigrationInterface {
    name = 'AddUniquePaymentIntentToOrders1787439000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const duplicates: Array<{ paymentIntentId: string; orders: number }> = await queryRunner.query(`
            SELECT \`paymentIntentId\`, COUNT(*) AS \`orders\`
            FROM \`orders\`
            WHERE \`paymentIntentId\` IS NOT NULL
            GROUP BY \`paymentIntentId\`
            HAVING COUNT(*) > 1
        `);
        if (duplicates.length > 0) {
            const sample = duplicates.slice(0, 10).map((d) => `${d.paymentIntentId} (${d.orders} orders)`).join(', ');
            throw new Error(
                `Cannot add UQ_orders_paymentIntentId: ${duplicates.length} payment intent(s) are linked to multiple orders: ${sample}. Reconcile these orders, then rerun the migration.`
            );
        }

        // Legacy schemas stored this column as LONGTEXT, which cannot carry a plain unique index.
        // Narrow it to match the entity (varchar → VARCHAR(255)); Stripe intent ids are ~30 chars.
        const [column]: Array<{ DATA_TYPE: string }> = await queryRunner.query(`
            SELECT DATA_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'paymentIntentId'
        `);
        if (column && column.DATA_TYPE !== 'varchar') {
            const [{ maxLength }]: Array<{ maxLength: number | null }> = await queryRunner.query(
                `SELECT MAX(CHAR_LENGTH(\`paymentIntentId\`)) AS \`maxLength\` FROM \`orders\``
            );
            if (Number(maxLength ?? 0) > 255) {
                throw new Error('Cannot narrow orders.paymentIntentId to VARCHAR(255): existing values exceed 255 characters.');
            }
            await queryRunner.query(`ALTER TABLE \`orders\` MODIFY \`paymentIntentId\` VARCHAR(255) NULL`);
        }

        const existing: unknown[] = await queryRunner.query(
            `SHOW INDEX FROM \`orders\` WHERE Key_name = 'UQ_orders_paymentIntentId'`
        );
        if (existing.length === 0) {
            await queryRunner.query(
                `CREATE UNIQUE INDEX \`UQ_orders_paymentIntentId\` ON \`orders\` (\`paymentIntentId\`)`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_orders_paymentIntentId\` ON \`orders\``);
    }
}
