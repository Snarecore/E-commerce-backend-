import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePopupTable1787427000000 implements MigrationInterface {
    name = 'CreatePopupTable1787427000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`popup\` (
                \`id\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`isDeleted\` tinyint(1) NOT NULL DEFAULT 0,
                \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
                \`priority\` int NOT NULL DEFAULT 0,
                \`title\` varchar(255) DEFAULT NULL,
                \`description\` text DEFAULT NULL,
                \`image\` varchar(500) NOT NULL,
                \`link\` varchar(500) DEFAULT NULL,
                \`startDate\` datetime DEFAULT NULL,
                \`endDate\` datetime DEFAULT NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE INDEX \`IDX_popup_schedule\` ON \`popup\` (\`isDeleted\`, \`isActive\`, \`priority\`, \`startDate\`, \`endDate\`);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_popup_schedule\` ON \`popup\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`popup\``);
    }
}
