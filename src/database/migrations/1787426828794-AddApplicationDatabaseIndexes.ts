import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApplicationDatabaseIndexes1787426828794 implements MigrationInterface {
    name = 'AddApplicationDatabaseIndexes1787426828794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Selective composite & single column indexes for high-traffic queries
        await queryRunner.query(`CREATE INDEX \`IDX_product_slug\` ON \`product\` (\`slug\`(255))`);
        await queryRunner.query(`CREATE INDEX \`IDX_product_vendor_status\` ON \`product\` (\`vendorId\`, \`status\`, \`isApprove\`, \`isDeleted\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_product_main_category\` ON \`product\` (\`mainCategoryId\`, \`status\`, \`isApprove\`, \`isDeleted\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_product_first_category\` ON \`product\` (\`firstCategoryId\`, \`status\`, \`isApprove\`, \`isDeleted\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_product_second_category\` ON \`product\` (\`secondCategoryId\`, \`status\`, \`isApprove\`, \`isDeleted\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_product_status_approve_created\` ON \`product\` (\`status\`, \`isApprove\`, \`isDeleted\`, \`createdAt\`)`);
        
        await queryRunner.query(`CREATE INDEX \`IDX_orders_orderId\` ON \`orders\` (\`orderId\`(255))`);
        await queryRunner.query(`CREATE INDEX \`IDX_orders_user_created\` ON \`orders\` (\`userId\`, \`createdAt\`)`);
        
        await queryRunner.query(`CREATE INDEX \`IDX_order_summary_vendor_created\` ON \`order-summary\` (\`vendorId\`, \`createdAt\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_order_summary_order\` ON \`order-summary\` (\`orderId\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_product_slug\` ON \`product\``);
        await queryRunner.query(`DROP INDEX \`IDX_product_vendor_status\` ON \`product\``);
        await queryRunner.query(`DROP INDEX \`IDX_product_main_category\` ON \`product\``);
        await queryRunner.query(`DROP INDEX \`IDX_product_first_category\` ON \`product\``);
        await queryRunner.query(`DROP INDEX \`IDX_product_second_category\` ON \`product\``);
        await queryRunner.query(`DROP INDEX \`IDX_product_status_approve_created\` ON \`product\``);
        
        await queryRunner.query(`DROP INDEX \`IDX_orders_orderId\` ON \`orders\``);
        await queryRunner.query(`DROP INDEX \`IDX_orders_user_created\` ON \`orders\``);
        
        await queryRunner.query(`DROP INDEX \`IDX_order_summary_vendor_created\` ON \`order-summary\``);
        await queryRunner.query(`DROP INDEX \`IDX_order_summary_order\` ON \`order-summary\``);
    }
}
