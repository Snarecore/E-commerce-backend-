import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentBannerToHeaderFooterCms1787447000000 implements MigrationInterface {
    name = 'AddPaymentBannerToHeaderFooterCms1787447000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('header-footer-cms')) ? 'header-footer-cms' : 'header_footer_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            if (!(await queryRunner.hasColumn(table, 'paymentBanner'))) {
                await queryRunner.query(
                    `ALTER TABLE \`${table}\` ADD COLUMN \`paymentBanner\` varchar(500) DEFAULT 'https://res.cloudinary.com/dps0qdamq/image/upload/v1795371802/payment-gateways/sslcommerz-verified-banner.png'`
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('header-footer-cms')) ? 'header-footer-cms' : 'header_footer_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            if (await queryRunner.hasColumn(table, 'paymentBanner')) {
                await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`paymentBanner\``);
            }
        }
    }
}
