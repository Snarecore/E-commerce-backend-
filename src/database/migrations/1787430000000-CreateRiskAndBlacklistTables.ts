import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRiskAndBlacklistTables1787430000000 implements MigrationInterface {
    name = 'CreateRiskAndBlacklistTables1787430000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. blacklists
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`blacklists\` (
                \`id\` varchar(36) NOT NULL,
                \`subject_type\` enum('PHONE','EXACT_IP','CIDR') NOT NULL,
                \`value_hash\` varchar(64) DEFAULT NULL,
                \`display_value\` varchar(100) DEFAULT NULL,
                \`customer_name\` varchar(100) DEFAULT NULL,
                \`customer_email\` varchar(100) DEFAULT NULL,
                \`ip_address\` varchar(45) DEFAULT NULL,
                \`address_family\` varchar(10) DEFAULT NULL,
                \`network_address\` varchar(45) DEFAULT NULL,
                \`prefix_length\` tinyint DEFAULT NULL,
                \`hash_version\` tinyint NOT NULL DEFAULT '1',
                \`severity\` enum('HARD_BLOCK','SUSPICIOUS_FLAG') NOT NULL,
                \`reason_code\` enum('FRAUD_HISTORY','MULTIPLE_RTO','CHARGEBACK','SUSPICIOUS_IP','ADMIN_REQUEST','POLICY_VIOLATION') NOT NULL DEFAULT 'ADMIN_REQUEST',
                \`note\` text DEFAULT NULL,
                \`created_by_admin_id\` varchar(36) DEFAULT NULL,
                \`actor_type\` varchar(20) NOT NULL DEFAULT 'ADMIN',
                \`status\` enum('ACTIVE','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
                \`expires_at\` datetime DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`idx_blacklist_phone_lookup\` (\`subject_type\`,\`value_hash\`,\`status\`),
                KEY \`idx_blacklist_ip_lookup\` (\`subject_type\`,\`ip_address\`,\`status\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. risk_subject_locks
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`risk_subject_locks\` (
                \`lock_key\` varchar(100) NOT NULL,
                \`subject_type\` varchar(20) NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`lock_key\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. risk_audit_logs
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`risk_audit_logs\` (
                \`id\` varchar(36) NOT NULL,
                \`actor_id\` varchar(36) NOT NULL,
                \`actor_type\` varchar(25) NOT NULL DEFAULT 'ADMIN',
                \`action\` varchar(100) NOT NULL,
                \`entity_type\` varchar(100) NOT NULL,
                \`entity_id\` varchar(36) NOT NULL,
                \`old_value\` json DEFAULT NULL,
                \`new_value\` json DEFAULT NULL,
                \`reason\` text DEFAULT NULL,
                \`ip_address\` varchar(45) DEFAULT NULL,
                \`request_id\` varchar(36) DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`idx_risk_audit_actor\` (\`actor_id\`, \`created_at\`),
                KEY \`idx_risk_audit_entity\` (\`entity_type\`, \`entity_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. customer_risk_subjects
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`customer_risk_subjects\` (
                \`id\` varchar(36) NOT NULL,
                \`total_orders\` int NOT NULL DEFAULT 0,
                \`successful_orders\` int NOT NULL DEFAULT 0,
                \`returned_orders\` int NOT NULL DEFAULT 0,
                \`cancelled_orders\` int NOT NULL DEFAULT 0,
                \`rejected_orders\` int NOT NULL DEFAULT 0,
                \`calculated_risk_score\` int NOT NULL DEFAULT 0,
                \`risk_level\` varchar(20) NOT NULL DEFAULT 'LOW',
                \`last_order_at\` datetime DEFAULT NULL,
                \`version\` int NOT NULL DEFAULT 1,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. customer_risk_phone_hashes
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`customer_risk_phone_hashes\` (
                \`id\` varchar(36) NOT NULL,
                \`phone_hash\` varchar(64) NOT NULL,
                \`hash_version\` tinyint NOT NULL DEFAULT 1,
                \`subject_id\` varchar(36) NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`idx_phone_hash_unique\` (\`phone_hash\`),
                KEY \`idx_customer_risk_phone_subject\` (\`subject_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 6. idempotency_keys
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`idempotency_keys\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`operation\` varchar(50) NOT NULL DEFAULT 'CHECKOUT_ORDER',
                \`idempotency_key\` varchar(255) NOT NULL,
                \`request_hash\` varchar(64) NOT NULL,
                \`processing_token\` varchar(36) DEFAULT NULL,
                \`status\` enum('PROCESSING','COMPLETED','FAILED_RETRYABLE') NOT NULL DEFAULT 'PROCESSING',
                \`response_status_code\` int DEFAULT NULL,
                \`response_headers\` json DEFAULT NULL,
                \`response_body\` json DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`uq_idempotency_scoped_key\` (\`user_id\`, \`operation\`, \`idempotency_key\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 7. outbox_events
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`outbox_events\` (
                \`id\` varchar(36) NOT NULL,
                \`event_key\` varchar(100) NOT NULL,
                \`event_type\` varchar(100) NOT NULL,
                \`aggregate_type\` varchar(50) NOT NULL,
                \`aggregate_id\` varchar(36) NOT NULL,
                \`payload\` json NOT NULL,
                \`status\` enum('PENDING','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
                \`attempt_count\` int NOT NULL DEFAULT 0,
                \`available_at\` datetime NOT NULL,
                \`lease_until\` datetime DEFAULT NULL,
                \`last_error\` text DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`uq_outbox_event_key\` (\`event_key\`),
                KEY \`idx_outbox_processing_claim\` (\`status\`, \`available_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`outbox_events\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`idempotency_keys\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`customer_risk_phone_hashes\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`customer_risk_subjects\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`risk_audit_logs\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`risk_subject_locks\`;`);
        await queryRunner.query(`DROP TABLE IF EXISTS \`blacklists\`;`);
    }
}
