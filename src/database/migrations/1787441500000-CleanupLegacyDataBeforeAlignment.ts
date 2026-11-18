import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data cleanup that must happen before AlignLegacySchemaWithEntities can add its unique
 * indexes, enums and foreign keys. Nothing is lost: every row that is changed or removed is
 * first copied into a `_legacy_backup_<table>` table, and unused legacy tables are renamed
 * with a `_legacy_` prefix instead of being dropped.
 *
 * 1. Duplicate user emails: keep one primary account per email (active first, then most
 *    orders, then oldest). Orders, reviews, comments, coupon usage, notifications and an
 *    orphaned chat move to it; the duplicates are soft-deleted and their email is freed.
 * 2. Orders whose userId matches no user (old builds stored a Firebase UID): relink by the
 *    shipping email when it matches exactly one active account, otherwise make them guest orders.
 * 3. Retired vendor feature: vendor users, their chats (customerId '') and messages.
 * 4. SEO rows with no product, and notifications duplicated by a double-fired event.
 * 5. Legacy tables no code reads are renamed out of the way.
 *
 * Every step is idempotent, so the migration can be re-run after an interruption.
 */

const LEGACY_TABLES = [
    'vendor-message',
    'vendor-payment-requests',
    'vendor-subscriptions',
    'subscription-tier',
    'commission-rate-cms',
    'refresh_token',
    'contact-us',
    'guest_account_claim',
    'checkout_phone_verification',
];

/** Tables whose user reference follows the primary account when duplicates are merged. */
const USER_REFERENCES: Array<{ table: string; column: string }> = [
    { table: 'orders', column: 'userId' },
    { table: 'product-review', column: 'userId' },
    { table: 'product_comments', column: 'userId' },
    { table: 'coupon_usage', column: 'userId' },
    { table: 'notifications', column: 'userId' },
];

const q = (name: string) => `\`${name.replace(/`/g, '``')}\``;

export class CleanupLegacyDataBeforeAlignment1787441500000 implements MigrationInterface {
    name = 'CleanupLegacyDataBeforeAlignment1787441500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.mergeDuplicateUsers(queryRunner);
        await this.repairOrphanedOrderOwners(queryRunner);
        await this.removeVendorData(queryRunner);
        await this.removeOrphanSeoAndDuplicateNotifications(queryRunner);
        await this.renameLegacyTables(queryRunner);
    }

    public async down(): Promise<void> {
        throw new Error(
            'CleanupLegacyDataBeforeAlignment is not reverted automatically. The original rows are in the _legacy_backup_* tables.'
        );
    }

    private async tableExists(runner: QueryRunner, table: string): Promise<boolean> {
        const rows: unknown[] = await runner.query(
            `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [table]
        );
        return rows.length > 0;
    }

    /** Copies the rows matched by `where` into `_legacy_backup_<table>` (created on first use). */
    private async backup(runner: QueryRunner, table: string, where: string, params: unknown[] = []): Promise<void> {
        const backupTable = `_legacy_backup_${table}`;
        if (!(await this.tableExists(runner, backupTable))) {
            await runner.query(`CREATE TABLE ${q(backupTable)} LIKE ${q(table)}`);
        }
        // INSERT IGNORE: a re-run must not fail on rows already backed up (same primary key).
        await runner.query(`INSERT IGNORE INTO ${q(backupTable)} SELECT * FROM ${q(table)} WHERE ${where}`, params);
    }

    private async mergeDuplicateUsers(runner: QueryRunner): Promise<void> {
        const groups: Array<{ email: string }> = await runner.query(
            'SELECT `email` FROM `user` WHERE `email` IS NOT NULL GROUP BY `email` HAVING COUNT(*) > 1'
        );

        for (const { email } of groups) {
            const accounts: Array<{ id: string }> = await runner.query(
                `SELECT u.id
                 FROM \`user\` u
                 LEFT JOIN (SELECT \`userId\`, COUNT(*) AS n FROM \`orders\` GROUP BY \`userId\`) o ON o.\`userId\` = u.id
                 WHERE u.email = ?
                 ORDER BY u.\`isDeleted\` ASC, COALESCE(o.n, 0) DESC, u.\`createdAt\` ASC, u.id ASC`,
                [email]
            );
            const [primary, ...duplicates] = accounts.map((a) => a.id);
            if (!primary || duplicates.length === 0) continue;
            const dupList = duplicates.map(() => '?').join(', ');

            for (const ref of USER_REFERENCES) {
                if (!(await this.tableExists(runner, ref.table))) continue;
                await this.backup(runner, ref.table, `${q(ref.column)} IN (${dupList})`, duplicates);
                await runner.query(
                    `UPDATE ${q(ref.table)} SET ${q(ref.column)} = ? WHERE ${q(ref.column)} IN (${dupList})`,
                    [primary, ...duplicates]
                );
            }

            // One profile per user: adopt a duplicate's profile only when the primary has none.
            const primaryHasProfile: unknown[] = await runner.query(
                'SELECT 1 FROM `user-profile` WHERE `userId` = ? LIMIT 1',
                [primary]
            );
            if (primaryHasProfile.length === 0) {
                const [profile]: Array<{ id: string }> = await runner.query(
                    `SELECT id FROM \`user-profile\` WHERE \`userId\` IN (${dupList}) ORDER BY \`updatedAt\` DESC LIMIT 1`,
                    duplicates
                );
                if (profile) {
                    await this.backup(runner, 'user-profile', 'id = ?', [profile.id]);
                    await runner.query('UPDATE `user-profile` SET `userId` = ? WHERE id = ?', [primary, profile.id]);
                }
            }

            // A customer has one chat (customerId is unique). Hand a duplicate's chat to the
            // primary only when the primary has none; otherwise it stays with the retired account.
            const primaryHasChat: unknown[] = await runner.query(
                'SELECT 1 FROM `conversations` WHERE `customerId` = ? LIMIT 1',
                [primary]
            );
            if (primaryHasChat.length === 0) {
                const [chat]: Array<{ id: string; customerId: string }> = await runner.query(
                    `SELECT id, \`customerId\` FROM \`conversations\` WHERE \`customerId\` IN (${dupList}) ORDER BY \`lastMessageAt\` DESC LIMIT 1`,
                    duplicates
                );
                if (chat) {
                    await this.backup(runner, 'conversations', 'id = ?', [chat.id]);
                    await runner.query('UPDATE `conversations` SET `customerId` = ? WHERE id = ?', [primary, chat.id]);
                    await this.backup(runner, 'messages', '`conversationId` = ? AND `senderId` = ?', [chat.id, chat.customerId]);
                    await runner.query('UPDATE `messages` SET `senderId` = ? WHERE `conversationId` = ? AND `senderId` = ?', [
                        primary,
                        chat.id,
                        chat.customerId,
                    ]);
                }
            }

            // Retire the duplicates: soft-delete and move them off the shared email so the
            // unique index can be created. The original email stays readable in the new value.
            await this.backup(runner, 'user', `id IN (${dupList})`, duplicates);
            await runner.query(
                `UPDATE \`user\` SET \`isDeleted\` = 1, \`email\` = CONCAT('dup-', LEFT(id, 8), '+', \`email\`) WHERE id IN (${dupList})`,
                duplicates
            );
        }
    }

    private async repairOrphanedOrderOwners(runner: QueryRunner): Promise<void> {
        const orphanWhere =
            '`userId` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `user` u WHERE u.id = `orders`.`userId`)';
        await this.backup(runner, 'orders', orphanWhere);

        const orphans: Array<{ id: string; email: string | null }> = await runner.query(
            `SELECT id, CAST(JSON_UNQUOTE(JSON_EXTRACT(\`shippingAddress\`, '$.email')) AS CHAR(255)) AS email
             FROM \`orders\` WHERE ${orphanWhere}`
        );
        for (const order of orphans) {
            let owner: string | null = null;
            const email = (order.email || '').trim().toLowerCase();
            if (email && email !== 'null') {
                const matches: Array<{ id: string }> = await runner.query(
                    'SELECT id FROM `user` WHERE LOWER(`email`) = ? AND `isDeleted` = 0 LIMIT 2',
                    [email]
                );
                if (matches.length === 1) owner = matches[0].id;
            }
            await runner.query('UPDATE `orders` SET `userId` = ? WHERE id = ?', [owner, order.id]);
        }
    }

    private async removeVendorData(runner: QueryRunner): Promise<void> {
        const vendorChats = "`customerId` = '' OR `customerId` IS NULL";
        await this.backup(runner, 'messages', `\`conversationId\` IN (SELECT id FROM \`conversations\` WHERE ${vendorChats}) OR \`senderRole\` = 'vendor'`);
        await runner.query(
            `DELETE FROM \`messages\` WHERE \`conversationId\` IN (SELECT id FROM \`conversations\` WHERE ${vendorChats}) OR \`senderRole\` = 'vendor'`
        );
        await this.backup(runner, 'conversations', vendorChats);
        await runner.query(`DELETE FROM \`conversations\` WHERE ${vendorChats}`);

        // Vendor accounts own no orders (checked before writing this migration); keep a copy anyway.
        const vendorOrders: Array<{ n: number }> = await runner.query(
            "SELECT COUNT(*) AS n FROM `orders` o JOIN `user` u ON u.id = o.`userId` WHERE u.`role` = 'vendor'"
        );
        if (Number(vendorOrders[0]?.n ?? 0) > 0) {
            throw new Error('Vendor accounts now own orders; review them before removing vendor users.');
        }
        // Vendor replies on product pages stay visible; only the author link goes, matching the
        // entity's ON DELETE SET NULL for product_comments.userId.
        const vendorIds = "(SELECT id FROM `user` WHERE `role` = 'vendor')";
        await this.backup(runner, 'product_comments', `\`userId\` IN ${vendorIds}`);
        await runner.query(`UPDATE \`product_comments\` SET \`userId\` = NULL WHERE \`userId\` IN ${vendorIds}`);

        await this.backup(runner, 'user-profile', "`userId` IN (SELECT id FROM `user` WHERE `role` = 'vendor')");
        await runner.query("DELETE FROM `user-profile` WHERE `userId` IN (SELECT id FROM `user` WHERE `role` = 'vendor')");
        await this.backup(runner, 'user', "`role` = 'vendor'");
        await runner.query("DELETE FROM `user` WHERE `role` = 'vendor'");
    }

    private async removeOrphanSeoAndDuplicateNotifications(runner: QueryRunner): Promise<void> {
        const orphanSeo = 'NOT EXISTS (SELECT 1 FROM `product` p WHERE p.id = `product-seo`.`productId`)';
        await this.backup(runner, 'product-seo', orphanSeo);
        await runner.query(`DELETE FROM \`product-seo\` WHERE ${orphanSeo}`);

        // Keep the earliest of each (type, orderId) pair; later copies came from a double-fired event.
        const laterCopies = `id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY \`type\`, \`orderId\` ORDER BY \`createdAt\`, id) AS rn
                FROM \`notifications\` WHERE \`orderId\` IS NOT NULL
            ) ranked WHERE rn > 1
        )`;
        await this.backup(runner, 'notifications', laterCopies);
        await runner.query(`DELETE FROM \`notifications\` WHERE ${laterCopies}`);
    }

    private async renameLegacyTables(runner: QueryRunner): Promise<void> {
        for (const table of LEGACY_TABLES) {
            const renamed = `_legacy_${table}`;
            if ((await this.tableExists(runner, table)) && !(await this.tableExists(runner, renamed))) {
                await runner.query(`RENAME TABLE ${q(table)} TO ${q(renamed)}`);
            }
        }
    }
}
