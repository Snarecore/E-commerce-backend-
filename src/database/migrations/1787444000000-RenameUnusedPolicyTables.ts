import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Three pre-`policy-*-cms` tables are no longer read by any code. They are renamed with a
 * `_legacy_` prefix (not dropped) so their single rows stay recoverable.
 */
const TABLES = ['privacy-policy-cms', 'return_policy_cms', 'terms_and_conditions_cms'];

export class RenameUnusedPolicyTables1787444000000 implements MigrationInterface {
    name = 'RenameUnusedPolicyTables1787444000000';

    private async exists(runner: QueryRunner, table: string): Promise<boolean> {
        const rows: unknown[] = await runner.query(
            'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            [table]
        );
        return rows.length > 0;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of TABLES) {
            if ((await this.exists(queryRunner, table)) && !(await this.exists(queryRunner, `_legacy_${table}`))) {
                await queryRunner.query(`RENAME TABLE \`${table}\` TO \`_legacy_${table}\``);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of TABLES) {
            if ((await this.exists(queryRunner, `_legacy_${table}`)) && !(await this.exists(queryRunner, table))) {
                await queryRunner.query(`RENAME TABLE \`_legacy_${table}\` TO \`${table}\``);
            }
        }
    }
}
