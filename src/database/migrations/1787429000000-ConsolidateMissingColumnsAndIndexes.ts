import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateMissingColumnsAndIndexes1787429000000 implements MigrationInterface {
    name = 'ConsolidateMissingColumnsAndIndexes1787429000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Table: notifications (Ensure Table exists)
        const hasNotificationsTable = await queryRunner.hasTable('notifications');
        if (!hasNotificationsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS \`notifications\` (
                    \`id\` varchar(36) NOT NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`isDeleted\` tinyint(4) NOT NULL DEFAULT 0,
                    \`userId\` varchar(255) DEFAULT NULL,
                    \`role\` varchar(50) NOT NULL DEFAULT 'CUSTOMER',
                    \`title\` varchar(255) NOT NULL,
                    \`message\` text NOT NULL,
                    \`type\` varchar(100) NOT NULL DEFAULT 'GENERAL',
                    \`orderId\` varchar(255) DEFAULT NULL,
                    \`metadata\` json DEFAULT NULL,
                    \`isRead\` tinyint(4) NOT NULL DEFAULT 0,
                    PRIMARY KEY (\`id\`),
                    KEY \`IDX_notifications_userId\` (\`userId\`),
                    KEY \`IDX_notifications_role_createdAt\` (\`role\`, \`createdAt\`),
                    KEY \`IDX_notifications_role_isRead_createdAt\` (\`role\`, \`isRead\`, \`createdAt\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
        } else {
            // Reconcile columns in notifications
            if (!(await queryRunner.hasColumn('notifications', 'role'))) {
                await queryRunner.query(`ALTER TABLE \`notifications\` ADD COLUMN \`role\` varchar(50) NOT NULL DEFAULT 'CUSTOMER'`);
            }
            if (!(await queryRunner.hasColumn('notifications', 'metadata'))) {
                await queryRunner.query(`ALTER TABLE \`notifications\` ADD COLUMN \`metadata\` json NULL`);
            }
            try {
                await queryRunner.query(`ALTER TABLE \`notifications\` MODIFY COLUMN \`userId\` varchar(255) NULL`);
            } catch (e) {}
        }

        // 2. Table: coupon (Ensure Table exists)
        const hasCouponTable = await queryRunner.hasTable('coupon');
        if (!hasCouponTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS \`coupon\` (
                    \`id\` varchar(255) NOT NULL,
                    \`code\` varchar(255) NOT NULL,
                    \`description\` text NULL,
                    \`discountType\` enum('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING') NOT NULL DEFAULT 'PERCENTAGE',
                    \`discountValue\` decimal(10,2) NOT NULL DEFAULT '0.00',
                    \`minOrderAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
                    \`maxDiscountAmount\` decimal(10,2) NULL,
                    \`startDate\` datetime NULL,
                    \`endDate\` datetime NULL,
                    \`usageLimit\` int NULL,
                    \`userUsageLimit\` int NULL DEFAULT NULL,
                    \`usageCount\` int NOT NULL DEFAULT '0',
                    \`isActive\` tinyint NOT NULL DEFAULT '1',
                    \`isDeleted\` tinyint NOT NULL DEFAULT '0',
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`id\`),
                    UNIQUE KEY \`UQ_coupon_code\` (\`code\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } else {
            if (!(await queryRunner.hasColumn('coupon', 'userUsageLimit'))) {
                await queryRunner.query(`ALTER TABLE \`coupon\` ADD COLUMN \`userUsageLimit\` int NULL DEFAULT NULL`);
            }
        }

        // 2.1 Table: coupon_usage (Ensure Table exists)
        const hasCouponUsageTable = await queryRunner.hasTable('coupon_usage');
        if (!hasCouponUsageTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS \`coupon_usage\` (
                    \`id\` varchar(255) NOT NULL,
                    \`couponId\` varchar(255) NOT NULL,
                    \`userId\` varchar(255) NOT NULL,
                    \`orderId\` varchar(255) NOT NULL,
                    \`discountAmount\` decimal(10,2) NOT NULL,
                    \`usedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`isDeleted\` tinyint NOT NULL DEFAULT '0',
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`id\`),
                    KEY \`IDX_coupon_user\` (\`couponId\`,\`userId\`),
                    KEY \`IDX_coupon_order\` (\`couponId\`,\`orderId\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        }

        // 3. Table: orders
        const hasOrdersTable = await queryRunner.hasTable('orders');
        if (hasOrdersTable) {
            if (!(await queryRunner.hasColumn('orders', 'rejectionReason'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionReason\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn('orders', 'rejectionMessage'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`rejectionMessage\` text NULL`);
            }
            if (!(await queryRunner.hasColumn('orders', 'megaDiscountApplied'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`megaDiscountApplied\` tinyint(1) NOT NULL DEFAULT 0`);
            }
            if (!(await queryRunner.hasColumn('orders', 'megaDiscountPercentage'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`megaDiscountPercentage\` decimal(5,2) NULL`);
            }
            if (!(await queryRunner.hasColumn('orders', 'couponId'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`couponId\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn('orders', 'couponCode'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`couponCode\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn('orders', 'discountAmount'))) {
                await queryRunner.query(`ALTER TABLE \`orders\` ADD COLUMN \`discountAmount\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
            }
            try {
                await queryRunner.query(`ALTER TABLE \`orders\` MODIFY COLUMN \`userId\` varchar(255) NULL`);
            } catch (e) {}

            try {
                await queryRunner.query(`CREATE INDEX \`IDX_orders_status_created\` ON \`orders\` (\`status\`, \`createdAt\`)`);
            } catch (e) {}
            try {
                await queryRunner.query(`CREATE INDEX \`IDX_orders_payment_status\` ON \`orders\` (\`paymentStatus\`, \`createdAt\`)`);
            } catch (e) {}
        }

        // 4. Table: order-summary / order_summary
        const targetSummaryTable = (await queryRunner.hasTable('order-summary')) ? 'order-summary' : (await queryRunner.hasTable('order_summary')) ? 'order_summary' : null;
        if (targetSummaryTable) {
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'size'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`size\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'selectedSize'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`selectedSize\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'unitCostPrice'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`unitCostPrice\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'totalCost'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`totalCost\` decimal(10,2) NOT NULL DEFAULT '0.00'`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'costSource'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`costSource\` varchar(50) NOT NULL DEFAULT 'SNAPSHOT'`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'snapshotMainCategoryId'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`snapshotMainCategoryId\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'snapshotFirstCategoryId'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`snapshotFirstCategoryId\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'snapshotSecondCategoryId'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`snapshotSecondCategoryId\` varchar(255) NULL`);
            }
            if (!(await queryRunner.hasColumn(targetSummaryTable, 'commissionAmount'))) {
                await queryRunner.query(`ALTER TABLE \`${targetSummaryTable}\` ADD COLUMN \`commissionAmount\` decimal(10,2) NULL`);
            }

            // Data Backfill
            try {
                await queryRunner.query(`
                    UPDATE \`${targetSummaryTable}\` os
                    LEFT JOIN \`product\` p ON os.productId = p.id
                    SET 
                        os.unitCostPrice = IF(p.cost IS NOT NULL AND p.cost > 0, p.cost, 0.00),
                        os.totalCost = IF(p.cost IS NOT NULL AND p.cost > 0, ROUND(p.cost * os.quantity, 2), 0.00),
                        os.costSource = IF(p.cost IS NOT NULL AND p.cost > 0, 'MIGRATED', 'UNKNOWN'),
                        os.snapshotMainCategoryId = p.mainCategoryId,
                        os.snapshotFirstCategoryId = p.firstCategoryId,
                        os.snapshotSecondCategoryId = p.secondCategoryId
                    WHERE (os.unitCostPrice IS NULL OR os.unitCostPrice = 0.00) AND os.costSource = 'SNAPSHOT';
                `);
            } catch (e) {}

            try {
                await queryRunner.query(`CREATE INDEX \`IDX_order_summary_costSource\` ON \`${targetSummaryTable}\` (\`costSource\`)`);
            } catch (e) {}
            try {
                await queryRunner.query(`CREATE INDEX \`IDX_order_summary_categories\` ON \`${targetSummaryTable}\` (\`snapshotMainCategoryId\`, \`snapshotFirstCategoryId\`)`);
            } catch (e) {}
        }

        // 5. Table: product_comments
        const hasCommentsTable = await queryRunner.hasTable('product_comments');
        if (hasCommentsTable) {
            if (!(await queryRunner.hasColumn('product_comments', 'isApproved'))) {
                await queryRunner.query(`ALTER TABLE \`product_comments\` ADD COLUMN \`isApproved\` tinyint(1) NOT NULL DEFAULT 0`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Safe rollback if needed
    }
}
