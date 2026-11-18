import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `product-seo.productId` ended up with two identical UNIQUE indexes. The one TypeORM owns for
 * the one-to-one relation (REL_77936d7d083c62031709394a3e) stays; the duplicate goes.
 */
export class DropRedundantProductSeoIndex1787443000000 implements MigrationInterface {
    name = 'DropRedundantProductSeoIndex1787443000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const rows: unknown[] = await queryRunner.query(
            "SHOW INDEX FROM `product-seo` WHERE Key_name = 'IDX_77936d7d083c62031709394a3e'"
        );
        if (rows.length > 0) {
            await queryRunner.query('DROP INDEX `IDX_77936d7d083c62031709394a3e` ON `product-seo`');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE UNIQUE INDEX `IDX_77936d7d083c62031709394a3e` ON `product-seo` (`productId`)'
        );
    }
}
