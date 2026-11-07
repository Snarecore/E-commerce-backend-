-- Migration Script: Create Enterprise Payments, Events, Refunds Tables & Backfill Legacy Orders

-- 1. Create 'payments' table
CREATE TABLE IF NOT EXISTS `payments` (
    `id` varchar(36) NOT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
    `orderId` varchar(36) NOT NULL,
    `gateway` enum('SSLCOMMERZ','STRIPE','COD') NOT NULL DEFAULT 'SSLCOMMERZ',
    `paymentMethod` enum('BKASH','NAGAD','ROCKET','UPAY','VISA','MASTERCARD','BANK','COD','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `tranId` varchar(255) NOT NULL,
    `valId` varchar(255) DEFAULT NULL,
    `bankTranId` varchar(255) DEFAULT NULL,
    `gatewaySessionId` varchar(255) DEFAULT NULL,
    `gatewayTransactionId` varchar(255) DEFAULT NULL,
    `gatewayReference` varchar(255) DEFAULT NULL,
    `cardType` varchar(100) DEFAULT NULL,
    `cardIssuer` varchar(150) DEFAULT NULL,
    `cardBrand` varchar(100) DEFAULT NULL,
    `maskedAccountNo` varchar(100) DEFAULT NULL,
    `amount` decimal(10,2) NOT NULL,
    `currency` varchar(10) NOT NULL DEFAULT 'BDT',
    `status` enum('PENDING','PROCESSING','PAID','FAILED','CANCELLED','EXPIRED','UNKNOWN') NOT NULL DEFAULT 'PENDING',
    `failureCode` varchar(100) DEFAULT NULL,
    `failureReason` text DEFAULT NULL,
    `sessionExpiresAt` timestamp NULL DEFAULT NULL,
    `paidAt` timestamp NULL DEFAULT NULL,
    `lastReconciledAt` timestamp NULL DEFAULT NULL,
    `reconciliationAttempts` int NOT NULL DEFAULT 0,
    `nextCheckAt` timestamp NULL DEFAULT NULL,
    `needsAdminReview` tinyint(1) NOT NULL DEFAULT 0,
    `adminReviewReason` varchar(255) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `IDX_payments_tranId` (`tranId`),
    UNIQUE KEY `IDX_payments_valId` (`valId`),
    KEY `IDX_payments_orderId` (`orderId`),
    KEY `IDX_payments_bankTranId` (`bankTranId`),
    KEY `IDX_payments_reconciliation` (`gateway`, `status`, `nextCheckAt`, `reconciliationAttempts`),
    CONSTRAINT `FK_payments_order` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Create 'payment_events' table
CREATE TABLE IF NOT EXISTS `payment_events` (
    `id` varchar(36) NOT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
    `paymentId` varchar(36) NOT NULL,
    `eventType` varchar(100) NOT NULL,
    `source` enum('BROWSER_CALLBACK','IPN','RECONCILIATION_WORKER','ADMIN') NOT NULL,
    `providerEventId` varchar(255) DEFAULT NULL,
    `eventFingerprint` varchar(64) NOT NULL,
    `gatewayStatus` varchar(100) NOT NULL,
    `sanitizedPayload` json DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `IDX_payment_events_paymentId` (`paymentId`),
    UNIQUE KEY `UQ_payment_event_fingerprint` (`paymentId`, `eventFingerprint`),
    CONSTRAINT `FK_payment_events_payment` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Create 'payment_refunds' table
CREATE TABLE IF NOT EXISTS `payment_refunds` (
    `id` varchar(36) NOT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
    `paymentId` varchar(36) NOT NULL,
    `refundId` varchar(100) NOT NULL,
    `gatewayRefundId` varchar(255) DEFAULT NULL,
    `amount` decimal(10,2) NOT NULL,
    `status` enum('PENDING','PROCESSING','SUCCEEDED','FAILED','UNKNOWN') NOT NULL DEFAULT 'PENDING',
    `reason` varchar(255) NOT NULL,
    `failureReason` text DEFAULT NULL,
    `initiatedBy` varchar(50) NOT NULL DEFAULT 'SYSTEM',
    `initiatedByUserId` varchar(255) DEFAULT NULL,
    `idempotencyKey` varchar(255) NOT NULL,
    `completedAt` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `UQ_payment_refunds_refundId` (`refundId`),
    UNIQUE KEY `UQ_payment_refunds_idempotency` (`idempotencyKey`),
    KEY `IDX_payment_refunds_paymentId` (`paymentId`),
    CONSTRAINT `FK_payment_refunds_payment` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Create 'payment_audit_logs' table
CREATE TABLE IF NOT EXISTS `payment_audit_logs` (
    `id` varchar(36) NOT NULL,
    `paymentId` varchar(36) DEFAULT NULL,
    `refundId` varchar(100) DEFAULT NULL,
    `action` varchar(100) NOT NULL,
    `actorId` varchar(255) NOT NULL,
    `actorRole` varchar(50) NOT NULL DEFAULT 'admin',
    `previousState` varchar(100) DEFAULT NULL,
    `newState` varchar(100) DEFAULT NULL,
    `reason` text DEFAULT NULL,
    `metadata` json DEFAULT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `IDX_payment_audit_logs_paymentId` (`paymentId`),
    KEY `IDX_payment_audit_logs_refundId` (`refundId`),
    KEY `IDX_payment_audit_logs_action` (`action`),
    KEY `IDX_payment_audit_logs_actorId` (`actorId`),
    KEY `IDX_payment_audit_logs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Create 'payment_webhook_inbox' table
CREATE TABLE IF NOT EXISTS `payment_webhook_inbox` (
    `id` varchar(36) NOT NULL,
    `gateway` enum('SSLCOMMERZ','STRIPE') NOT NULL DEFAULT 'SSLCOMMERZ',
    `eventType` varchar(100) NOT NULL,
    `payload` json NOT NULL,
    `idempotencyKey` varchar(255) NOT NULL,
    `status` enum('PENDING','PROCESSING','PROCESSED','FAILED','DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
    `retryCount` int NOT NULL DEFAULT 0,
    `leaseToken` varchar(255) DEFAULT NULL,
    `leaseExpiresAt` timestamp NULL DEFAULT NULL,
    `nextAttemptAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `processedAt` timestamp NULL DEFAULT NULL,
    `failureReason` text DEFAULT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `UQ_payment_webhook_inbox_idempotency` (`idempotencyKey`),
    KEY `IDX_payment_webhook_inbox_processing` (`status`, `nextAttemptAt`, `leaseExpiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Create 'payment_outbox_events' table
CREATE TABLE IF NOT EXISTS `payment_outbox_events` (
    `id` varchar(36) NOT NULL,
    `aggregateType` varchar(50) NOT NULL,
    `aggregateId` varchar(255) NOT NULL,
    `eventType` varchar(100) NOT NULL,
    `payload` json NOT NULL,
    `status` enum('PENDING','PROCESSING','PUBLISHED','FAILED') NOT NULL DEFAULT 'PENDING',
    `retryCount` int NOT NULL DEFAULT 0,
    `nextAttemptAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `publishedAt` timestamp NULL DEFAULT NULL,
    `failureReason` text DEFAULT NULL,
    `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `IDX_payment_outbox_processing` (`status`, `nextAttemptAt`),
    KEY `IDX_payment_outbox_aggregate` (`aggregateType`, `aggregateId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Update 'orders' table schema
ALTER TABLE `orders`
    ADD COLUMN IF NOT EXISTS `customerIntentFingerprint` varchar(64) NULL,
    ADD COLUMN IF NOT EXISTS `authoritativeSnapshot` json NULL,
    ADD COLUMN IF NOT EXISTS `orderPaymentExpiresAt` timestamp NULL;

ALTER TABLE `orders`
    MODIFY COLUMN `paymentStatus` enum('Pending','Paid','Unpaid','Failed','Review Required','Partially Refunded','Refunded') NOT NULL DEFAULT 'Pending';

-- 5. Idempotent Backfill: Populate 'payments' table from existing legacy orders
INSERT INTO `payments` (
    `id`,
    `createdAt`,
    `updatedAt`,
    `isDeleted`,
    `orderId`,
    `gateway`,
    `paymentMethod`,
    `tranId`,
    `gatewayTransactionId`,
    `gatewaySessionId`,
    `gatewayReference`,
    `amount`,
    `currency`,
    `status`,
    `paidAt`
)
SELECT 
    UUID(),
    o.createdAt,
    o.updatedAt,
    o.isDeleted,
    o.id,
    CASE 
        WHEN o.paymentMethod = 'Online' OR o.paymentIntentId LIKE 'pi_%' THEN 'STRIPE'
        ELSE 'COD'
    END,
    CASE 
        WHEN o.paymentMethod = 'Online' OR o.paymentIntentId LIKE 'pi_%' THEN 'VISA'
        ELSE 'COD'
    END,
    CONCAT(
        CASE 
            WHEN o.paymentMethod = 'Online' OR o.paymentIntentId LIKE 'pi_%' THEN 'LEGACY-STRIPE-'
            ELSE 'LEGACY-COD-'
        END,
        o.orderId,
        '-',
        SUBSTRING(MD5(CONCAT(o.id, o.createdAt)), 1, 6)
    ),
    o.paymentIntentId,
    o.stripeSessionId,
    CASE 
        WHEN o.paymentMethod = 'COD' OR o.paymentMethod IS NULL THEN CONCAT('COD-', o.orderId)
        ELSE NULL
    END,
    o.totalAmount,
    COALESCE(o.currency, 'BDT'),
    CASE 
        WHEN o.paymentStatus = 'Paid' THEN 'PAID'
        WHEN o.paymentStatus = 'Failed' THEN 'FAILED'
        ELSE 'PENDING'
    END,
    CASE WHEN o.paymentStatus = 'Paid' THEN o.createdAt ELSE NULL END
FROM `orders` o
LEFT JOIN `payments` p ON p.orderId = o.id
WHERE p.id IS NULL;
