import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryProcessToHomePageCms1787446000000 implements MigrationInterface {
    name = 'AddDeliveryProcessToHomePageCms1787446000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('home-page-cms')) ? 'home-page-cms' : 'home_page_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            const columnsToAdd = [
                { name: 'isDeliveryProcessVisible', type: 'tinyint(1) DEFAULT 1' },
                { name: 'deliveryProcessBadge', type: "varchar(255) DEFAULT 'Seamless Fulfillment Journey'" },
                { name: 'deliveryProcessTitle', type: "varchar(255) DEFAULT 'How Your Order Reaches Your Doorstep'" },
                { name: 'deliveryProcessDescription', type: 'text DEFAULT NULL' },
                { name: 'deliveryStepOneTitle', type: "varchar(255) DEFAULT 'Order & Verification'" },
                { name: 'deliveryStepOneHighlight', type: "varchar(255) DEFAULT 'Instant Confirmation'" },
                { name: 'deliveryStepOneDescription', type: 'text DEFAULT NULL' },
                { name: 'deliveryStepTwoTitle', type: "varchar(255) DEFAULT 'Quality Check & Packing'" },
                { name: 'deliveryStepTwoHighlight', type: "varchar(255) DEFAULT '100% Inspected'" },
                { name: 'deliveryStepTwoDescription', type: 'text DEFAULT NULL' },
                { name: 'deliveryStepThreeTitle', type: "varchar(255) DEFAULT 'Express Dispatch & Transit'" },
                { name: 'deliveryStepThreeHighlight', type: "varchar(255) DEFAULT '24-48h Fast Dispatch'" },
                { name: 'deliveryStepThreeDescription', type: 'text DEFAULT NULL' },
                { name: 'deliveryStepFourTitle', type: "varchar(255) DEFAULT 'Doorstep Delivery & Trial'" },
                { name: 'deliveryStepFourHighlight', type: "varchar(255) DEFAULT '7-Day Easy Returns'" },
                { name: 'deliveryStepFourDescription', type: 'text DEFAULT NULL' },
            ];

            for (const col of columnsToAdd) {
                if (!(await queryRunner.hasColumn(table, col.name))) {
                    await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.type}`);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('home-page-cms')) ? 'home-page-cms' : 'home_page_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            const columnsToDrop = [
                'deliveryStepFourDescription',
                'deliveryStepFourHighlight',
                'deliveryStepFourTitle',
                'deliveryStepThreeDescription',
                'deliveryStepThreeHighlight',
                'deliveryStepThreeTitle',
                'deliveryStepTwoDescription',
                'deliveryStepTwoHighlight',
                'deliveryStepTwoTitle',
                'deliveryStepOneDescription',
                'deliveryStepOneHighlight',
                'deliveryStepOneTitle',
                'deliveryProcessDescription',
                'deliveryProcessTitle',
                'deliveryProcessBadge',
                'isDeliveryProcessVisible',
            ];

            for (const col of columnsToDrop) {
                if (await queryRunner.hasColumn(table, col)) {
                    await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${col}\``);
                }
            }
        }
    }
}
