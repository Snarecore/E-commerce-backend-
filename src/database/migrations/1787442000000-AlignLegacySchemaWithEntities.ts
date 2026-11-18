import { MigrationInterface, QueryRunner } from 'typeorm';
import { runSchemaAlignment } from './support/schema-alignment';
import { SCHEMA_ALIGNMENT_OPS } from './support/schema-alignment.ops';

/**
 * Legacy tables were created outside migrations: no primary keys, LONGTEXT everywhere,
 * DATETIME instead of TIMESTAMP, missing indexes and foreign keys. This aligns them with
 * the entities so `migration:generate` stops proposing destructive DROP/ADD COLUMN pairs.
 *
 * Every column change is an in-place MODIFY. The run checks all data first and aborts before
 * any DDL if a value would not fit, and it is safe to re-run after an interruption.
 *
 * Take a database backup before running this in production.
 */
export class AlignLegacySchemaWithEntities1787442000000 implements MigrationInterface {
    name = 'AlignLegacySchemaWithEntities1787442000000';

    // No `transaction` override: the CLI runs with transaction "all", which rejects overrides.
    // DDL auto-commits in MySQL/TiDB anyway, which is why the runner prechecks and is re-runnable.

    public async up(queryRunner: QueryRunner): Promise<void> {
        await runSchemaAlignment(queryRunner, SCHEMA_ALIGNMENT_OPS);
    }

    public async down(): Promise<void> {
        throw new Error(
            'AlignLegacySchemaWithEntities cannot be reverted automatically. Restore the pre-migration backup instead.'
        );
    }
}
