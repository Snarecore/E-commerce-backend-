import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorefrontThemeToHeaderFooterCms1787431000000 implements MigrationInterface {
    name = 'AddStorefrontThemeToHeaderFooterCms1787431000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('header-footer-cms')) ? 'header-footer-cms' : 'header_footer_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            if (!(await queryRunner.hasColumn(table, 'primaryColor'))) {
                await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`primaryColor\` varchar(50) DEFAULT '#218DAE'`);
            }
            if (!(await queryRunner.hasColumn(table, 'secondaryColor'))) {
                await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`secondaryColor\` varchar(50) DEFAULT '#1D7693'`);
            }
            if (!(await queryRunner.hasColumn(table, 'themeConfig'))) {
                await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`themeConfig\` json DEFAULT NULL`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = (await queryRunner.hasTable('header-footer-cms')) ? 'header-footer-cms' : 'header_footer_cms';
        const exists = await queryRunner.hasTable(table);

        if (exists) {
            if (await queryRunner.hasColumn(table, 'themeConfig')) {
                await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`themeConfig\``);
            }
            if (await queryRunner.hasColumn(table, 'secondaryColor')) {
                await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`secondaryColor\``);
            }
            if (await queryRunner.hasColumn(table, 'primaryColor')) {
                await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`primaryColor\``);
            }
        }
    }
}
