import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveBlogAndThirdCategory1787426547217 implements MigrationInterface {
    name = 'RemoveBlogAndThirdCategory1787426547217'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove thirdCategory columns from product table
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`thirdCategoryId\``);
        await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`thirdCategoryName\``);

        // Drop third-category and blog tables
        await queryRunner.query(`DROP TABLE \`third-category\``);
        await queryRunner.query(`DROP TABLE \`blog\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-create blog table
        await queryRunner.query(`CREATE TABLE \`blog\` (
            \`id\` varchar(36) NOT NULL,
            \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            \`isDeleted\` tinyint NOT NULL DEFAULT 0,
            \`title\` varchar(255) NOT NULL,
            \`slug\` varchar(255) NOT NULL,
            \`content\` longtext NOT NULL,
            \`image\` varchar(255) NULL,
            \`author\` varchar(255) NULL,
            \`status\` tinyint NOT NULL DEFAULT 1,
            PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB`);

        // Re-create third-category table
        await queryRunner.query(`CREATE TABLE \`third-category\` (
            \`id\` varchar(36) NOT NULL,
            \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            \`isDeleted\` tinyint NOT NULL DEFAULT 0,
            \`name\` varchar(255) NOT NULL,
            \`slug\` varchar(255) NOT NULL,
            \`bannerImage\` varchar(255) NOT NULL,
            \`status\` tinyint NOT NULL DEFAULT 1,
            \`mainCategoryId\` varchar(255) NOT NULL,
            \`mainCategoryName\` varchar(255) NOT NULL,
            \`firstCategoryId\` varchar(255) NOT NULL,
            \`firstCategoryName\` varchar(255) NOT NULL,
            \`secondCategoryId\` varchar(255) NOT NULL,
            \`secondCategoryName\` varchar(255) NOT NULL,
            PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB`);

        // Re-add thirdCategory columns to product table
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`thirdCategoryId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`product\` ADD \`thirdCategoryName\` varchar(255) NULL`);
    }
}
