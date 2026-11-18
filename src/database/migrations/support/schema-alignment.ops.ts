/* Generated from TypeORM schema:log against a clone of production, then made data-preserving.
 * Phases: drop FKs, drop indexes, modify columns, add PKs, create indexes, add FKs.
 * Do not edit by hand; regenerate if entities change before this migration ships. */
import { SchemaAlignmentOp } from './schema-alignment';

export const SCHEMA_ALIGNMENT_OPS: SchemaAlignmentOp[] = [
 {
  "op": "dropForeignKey",
  "table": "payment_events",
  "name": "FK_payment_events_payment"
 },
 {
  "op": "dropForeignKey",
  "table": "payment_refunds",
  "name": "FK_payment_refunds_payment"
 },
 {
  "op": "dropForeignKey",
  "table": "payments",
  "name": "FK_payments_order"
 },
 {
  "op": "dropForeignKey",
  "table": "stock_adjustment_items",
  "name": "FK_adj_item_adjustment"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_vendor_status"
 },
 {
  "op": "dropIndex",
  "table": "payment_outbox_events",
  "name": "IDX_payment_outbox_processing"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_status_approve_created"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_second_category"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_first_category"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_main_category"
 },
 {
  "op": "dropIndex",
  "table": "product",
  "name": "IDX_product_slug"
 },
 {
  "op": "dropIndex",
  "table": "order-summary",
  "name": "IDX_order_summary_vendor_created"
 },
 {
  "op": "dropIndex",
  "table": "order-summary",
  "name": "IDX_order_summary_order"
 },
 {
  "op": "dropIndex",
  "table": "payment_events",
  "name": "UQ_payment_event_fingerprint"
 },
 {
  "op": "dropIndex",
  "table": "payment_events",
  "name": "IDX_payment_events_paymentId"
 },
 {
  "op": "dropIndex",
  "table": "payment_refunds",
  "name": "IDX_payment_refunds_paymentId"
 },
 {
  "op": "dropIndex",
  "table": "payments",
  "name": "IDX_payments_orderId"
 },
 {
  "op": "dropIndex",
  "table": "orders",
  "name": "IDX_orders_user_created"
 },
 {
  "op": "dropIndex",
  "table": "orders",
  "name": "IDX_orders_orderId"
 },
 {
  "op": "dropIndex",
  "table": "payment_webhook_inbox",
  "name": "IDX_payment_webhook_inbox_processing"
 },
 {
  "op": "dropIndex",
  "table": "payment_outbox_delivery_attempts",
  "name": "IDX_outbox_attempt_event"
 },
 {
  "op": "dropIndex",
  "table": "coupon_usage",
  "name": "IDX_coupon_user"
 },
 {
  "op": "dropIndex",
  "table": "popup",
  "name": "IDX_popup_schedule"
 },
 {
  "op": "modify",
  "table": "product-seo",
  "column": "productId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-seo",
  "column": "productName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-seo",
  "column": "productImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "slug",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "sku",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "featuredImage",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "videoUrl",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "fileUrl",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "discountType",
  "definition": "enum ('NONE', 'PERCENT', 'FLAT') NOT NULL DEFAULT 'NONE'"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "mainCategoryId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "mainCategoryName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "firstCategoryId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "firstCategoryName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "secondCategoryId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "secondCategoryName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "vendorId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "vendorName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "rating",
  "definition": "float NULL DEFAULT '0'"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isApprove",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionOne",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionTwo",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionThree",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionFour",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionFive",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product",
  "column": "isProductSectionSix",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "productId",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "body",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "product_comments",
  "column": "isApproved",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "productId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "productName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "productImage",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "isExchanged",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "price",
  "definition": "decimal(10,2) NOT NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "quantity",
  "definition": "int NOT NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "commissionAmount",
  "definition": "decimal(10,2) NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "vendorId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "order-summary",
  "column": "orderId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "payment_events",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "payment_events",
  "column": "paymentId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "payment_refunds",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "payment_refunds",
  "column": "paymentId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "payments",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "payments",
  "column": "orderId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "payments",
  "column": "needsAdminReview",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "orderId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "totalAmount",
  "definition": "decimal(10,2) NOT NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "currency",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "paymentMethod",
  "definition": "varchar(255) NULL DEFAULT 'COD'"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "specialNote",
  "definition": "text NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "subtotal",
  "definition": "decimal(10,2) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "deliveryCharge",
  "definition": "decimal(10,2) NOT NULL DEFAULT '0.00'"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "courierName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "trackingId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "courierTrackingLink",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "rejectionMessage",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "megaDiscountApplied",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "status",
  "definition": "enum ('Order Placed', 'Processing', 'Preparing Order', 'Shipped', 'Loaded for Delivery', 'Handed Over to Courier', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Pending', 'Completed', 'Failed', 'Rejected') NOT NULL DEFAULT 'Pending'"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "isExchanged",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "exchangedAt",
  "definition": "timestamp NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "isPhoneVerified",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "verifiedPhone",
  "definition": "varchar(20) NULL"
 },
 {
  "op": "modify",
  "table": "orders",
  "column": "verificationProvider",
  "definition": "varchar(32) NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "email",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "password",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "phone",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "refreshToken",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "resetTokenExpiry",
  "definition": "timestamp NULL"
 },
 {
  "op": "modify",
  "table": "user",
  "column": "role",
  "definition": "enum ('customer', 'admin') NOT NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "profileImage",
  "definition": "varchar(255) NULL DEFAULT 'https://cdn.bazaarbound.com/user-avatar.svg'"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "shopName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "shopImage",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "accountNumber",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "accountHolderName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "bankName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "branchName",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "IBAN",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "country",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "swiftCode",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "user-profile",
  "column": "paypalEmailAddress",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "roles",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "roles",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "roles",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "roles",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "roles",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "customer_risk_subjects",
  "column": "version",
  "definition": "int NOT NULL"
 },
 {
  "op": "modify",
  "table": "payment_webhook_inbox",
  "column": "gateway",
  "definition": "enum ('SSLCOMMERZ', 'STRIPE', 'COD') NOT NULL DEFAULT 'SSLCOMMERZ'"
 },
 {
  "op": "modify",
  "table": "payment_webhook_inbox",
  "column": "nextAttemptAt",
  "definition": "timestamp NULL"
 },
 {
  "op": "modify",
  "table": "payment_outbox_events",
  "column": "nextAttemptAt",
  "definition": "timestamp NULL"
 },
 {
  "op": "modify",
  "table": "payment_outbox_delivery_attempts",
  "column": "eventId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "stock_movements",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "stock_adjustments",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "stock_adjustment_items",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "notifications",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "notifications",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "notifications",
  "column": "role",
  "definition": "varchar(50) NULL DEFAULT 'CUSTOMER'"
 },
 {
  "op": "modify",
  "table": "coupon_usage",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "coupon_usage",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "coupon_usage",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "coupon_usage",
  "column": "userId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "coupon",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "coupon",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "coupon",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "checkout_phone_verifications",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "checkout_phone_verifications",
  "column": "provider",
  "definition": "varchar(32) NOT NULL DEFAULT 'DIRECT'"
 },
 {
  "op": "modify",
  "table": "guest_account_claims",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "auth_sessions",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "audit_logs",
  "column": "actorId",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "icon",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "social-link",
  "column": "link",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "image",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "link",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "promotions",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "mega_discount",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "mega_discount",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "mega_discount",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "mega_discount",
  "column": "menuText",
  "definition": "varchar(50) NULL DEFAULT 'Mega Sale'"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "bannerText",
  "definition": "text NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "helpline",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "footerDescription",
  "definition": "text NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "copyrightText",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "contactEmail",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "contactPhone",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "contactAddress",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "headerLogo",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "footerLogo",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "footerSectionTwoTitle",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "header-footer-cms",
  "column": "footerSectionThreeTitle",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "popup",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "popup",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "popup",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "popup",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "popup",
  "column": "isActive",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "image",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "link",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "hero-slider",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "email_settings",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "email_settings",
  "column": "secure",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "email_settings",
  "column": "isActive",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "question",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "faq",
  "column": "answer",
  "definition": "longtext NOT NULL"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "page",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "metaTitle",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "metaDescription",
  "definition": "text NULL"
 },
 {
  "op": "modify",
  "table": "page-meta",
  "column": "metaKeywords",
  "definition": "varchar(255) NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "slug",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "bannerImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "position",
  "definition": "int NOT NULL DEFAULT '9999'"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "mainCategoryId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "mainCategoryName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "firstCategoryId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "second-category",
  "column": "firstCategoryName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "productId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "rating",
  "definition": "float NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "userId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-review",
  "column": "vendorId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "productId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "product-image-gallery",
  "column": "imageUrl",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "slug",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "image",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "bannerImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "main-category",
  "column": "position",
  "definition": "int NOT NULL DEFAULT '9999'"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "slug",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "bannerImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "image",
  "definition": "varchar(255) NOT NULL DEFAULT ''"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "status",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "showOnHome",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "position",
  "definition": "int NOT NULL DEFAULT '9999'"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "mainCategoryId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "first-category",
  "column": "mainCategoryName",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "conversations",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "conversations",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "conversations",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "conversations",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "conversations",
  "column": "customerId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "conversationId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "senderId",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "senderRole",
  "definition": "enum ('customer', 'admin') NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "content",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "messages",
  "column": "isRead",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "shop-page-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "shop-page-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "shop-page-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "shop-page-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "shop-page-cms",
  "column": "bannerImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-three-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-seven-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-twelve-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-one-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-ten-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-six-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-four-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-two-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-nine-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-five-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eight-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "categorySectionTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isCategorySectionVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionOneTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionOneVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionOneFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionOneBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionTwoTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionTwoVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionTwoFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionTwoBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionThreeTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionThreeVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionThreeFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionThreeBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFourTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionFourVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFourFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFourBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFiveTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionFiveVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFiveFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionFiveBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionSixTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "isProductSectionSixVisible",
  "definition": "tinyint NOT NULL DEFAULT 1"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionSixFontColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "productSectionSixBackgroundColor",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "bannerImage",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "home-page-cms",
  "column": "bannerImageLink",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "title",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "policy-eleven-cms",
  "column": "description",
  "definition": "text NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "pageTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "pageSubTitle",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "phone",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "email",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "address",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "formSectionTitleOne",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "formSectionTitleTwo",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "formSectionTitleThree",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-page-cms",
  "column": "buttonText",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "id",
  "definition": "varchar(36) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "createdAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "updatedAt",
  "definition": "timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "isDeleted",
  "definition": "tinyint NOT NULL DEFAULT 0"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "name",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "email",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "phone",
  "definition": "varchar(255) NOT NULL"
 },
 {
  "op": "modify",
  "table": "contact-us-message",
  "column": "message",
  "definition": "longtext NOT NULL"
 },
 {
  "op": "addPrimaryKey",
  "table": "product",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "product_comments",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "order-summary",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "user",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "user-profile",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "roles",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "coupon_usage",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "coupon",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "social-link",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "promotions",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "mega_discount",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "header-footer-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "popup",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "hero-slider",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "faq",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "page-meta",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "second-category",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "product-review",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "product-image-gallery",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "main-category",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "first-category",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "conversations",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "messages",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "shop-page-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-three-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-seven-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-twelve-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-one-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-ten-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-six-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-four-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-two-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-nine-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-five-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-eight-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "home-page-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "policy-eleven-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "contact-page-cms",
  "columns": [
   "id"
  ]
 },
 {
  "op": "addPrimaryKey",
  "table": "contact-us-message",
  "columns": [
   "id"
  ]
 },
 {
  "op": "createIndex",
  "table": "product-seo",
  "name": "IDX_77936d7d083c62031709394a3e",
  "unique": true,
  "columns": [
   "productId"
  ]
 },
 {
  "op": "createIndex",
  "table": "user",
  "name": "IDX_e12875dfb3b1d92d7d7c5377e2",
  "unique": true,
  "columns": [
   "email"
  ]
 },
 {
  "op": "createIndex",
  "table": "conversations",
  "name": "IDX_5a4866f304edf4591ad785d34a",
  "unique": true,
  "columns": [
   "customerId"
  ]
 },
 {
  "op": "createIndex",
  "table": "product-seo",
  "name": "REL_77936d7d083c62031709394a3e",
  "unique": true,
  "columns": [
   "productId"
  ]
 },
 {
  "op": "createIndex",
  "table": "product",
  "name": "IDX_product_status_approve_created",
  "unique": false,
  "columns": [
   "status",
   "isApprove",
   "isDeleted",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "product",
  "name": "IDX_product_second_category",
  "unique": false,
  "columns": [
   "secondCategoryId",
   "status",
   "isApprove",
   "isDeleted"
  ]
 },
 {
  "op": "createIndex",
  "table": "product",
  "name": "IDX_product_first_category",
  "unique": false,
  "columns": [
   "firstCategoryId",
   "status",
   "isApprove",
   "isDeleted"
  ]
 },
 {
  "op": "createIndex",
  "table": "product",
  "name": "IDX_product_main_category",
  "unique": false,
  "columns": [
   "mainCategoryId",
   "status",
   "isApprove",
   "isDeleted"
  ]
 },
 {
  "op": "createIndex",
  "table": "product",
  "name": "IDX_product_slug",
  "unique": false,
  "columns": [
   "slug"
  ]
 },
 {
  "op": "createIndex",
  "table": "product_comments",
  "name": "IDX_fdbad702dfe8b213bec50b57f7",
  "unique": false,
  "columns": [
   "parentId",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "product_comments",
  "name": "IDX_e8fda0640e26309e7ed248dfb5",
  "unique": false,
  "columns": [
   "productId",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "order-summary",
  "name": "IDX_order_summary_order",
  "unique": false,
  "columns": [
   "orderId"
  ]
 },
 {
  "op": "createIndex",
  "table": "order-summary",
  "name": "IDX_order_summary_vendor_created",
  "unique": false,
  "columns": [
   "vendorId",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_events",
  "name": "UQ_payment_event_fingerprint",
  "unique": true,
  "columns": [
   "paymentId",
   "eventFingerprint"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_events",
  "name": "IDX_payment_events_paymentId",
  "unique": false,
  "columns": [
   "paymentId"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_refunds",
  "name": "IDX_payment_refunds_paymentId",
  "unique": false,
  "columns": [
   "paymentId"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_refunds",
  "name": "IDX_11a6606e17352dd748ff2ff6a2",
  "unique": true,
  "columns": [
   "refundId"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_refunds",
  "name": "IDX_5e3aae04859ca356a9cc4826fa",
  "unique": true,
  "columns": [
   "idempotencyKey"
  ]
 },
 {
  "op": "createIndex",
  "table": "payments",
  "name": "IDX_payments_orderId",
  "unique": false,
  "columns": [
   "orderId"
  ]
 },
 {
  "op": "createIndex",
  "table": "payments",
  "name": "IDX_f0d96c36191806c4067604b639",
  "unique": true,
  "columns": [
   "tranId"
  ]
 },
 {
  "op": "createIndex",
  "table": "payments",
  "name": "IDX_b9732e591f79c08018543b6035",
  "unique": true,
  "columns": [
   "valId"
  ]
 },
 {
  "op": "createIndex",
  "table": "orders",
  "name": "IDX_orders_payment_status",
  "unique": false,
  "columns": [
   "paymentStatus",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "orders",
  "name": "IDX_orders_status_created",
  "unique": false,
  "columns": [
   "status",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "orders",
  "name": "IDX_orders_user_created",
  "unique": false,
  "columns": [
   "userId",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "orders",
  "name": "IDX_orders_orderId",
  "unique": false,
  "columns": [
   "orderId"
  ]
 },
 {
  "op": "createIndex",
  "table": "customer_risk_phone_hashes",
  "name": "IDX_ae25446d5f24a9cde388906e58",
  "unique": true,
  "columns": [
   "phone_hash"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_webhook_inbox",
  "name": "IDX_payment_webhook_inbox_processing",
  "unique": false,
  "columns": [
   "status",
   "nextAttemptAt",
   "leaseExpiresAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_webhook_inbox",
  "name": "IDX_f371fbfb35a49b7632aef1f259",
  "unique": true,
  "columns": [
   "idempotencyKey"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_outbox_events",
  "name": "IDX_payment_outbox_processing",
  "unique": false,
  "columns": [
   "status",
   "nextAttemptAt",
   "leaseExpiresAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "payment_outbox_delivery_attempts",
  "name": "IDX_outbox_attempt_event",
  "unique": false,
  "columns": [
   "eventId",
   "startedAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "notifications",
  "name": "IDX_fe08f16f23251256fa96fbf2d0",
  "unique": true,
  "columns": [
   "type",
   "orderId"
  ]
 },
 {
  "op": "createIndex",
  "table": "notifications",
  "name": "IDX_87f2f4ba9a331c66a050dd0fd1",
  "unique": false,
  "columns": [
   "role",
   "isRead",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "notifications",
  "name": "IDX_802ab2697d611f56af71579b93",
  "unique": false,
  "columns": [
   "role",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "coupon_usage",
  "name": "IDX_coupon_phone",
  "unique": false,
  "columns": [
   "couponId",
   "phone"
  ]
 },
 {
  "op": "createIndex",
  "table": "coupon_usage",
  "name": "IDX_coupon_user",
  "unique": false,
  "columns": [
   "couponId",
   "userId"
  ]
 },
 {
  "op": "createIndex",
  "table": "guest_account_claims",
  "name": "IDX_880dd932428b645b0c7e0ef45b",
  "unique": true,
  "columns": [
   "tokenHash"
  ]
 },
 {
  "op": "createIndex",
  "table": "audit_logs",
  "name": "IDX_audit_target",
  "unique": false,
  "columns": [
   "targetType",
   "targetId"
  ]
 },
 {
  "op": "createIndex",
  "table": "audit_logs",
  "name": "IDX_audit_actor_created",
  "unique": false,
  "columns": [
   "actorId",
   "createdAt"
  ]
 },
 {
  "op": "createIndex",
  "table": "audit_logs",
  "name": "IDX_audit_created_action",
  "unique": false,
  "columns": [
   "createdAt",
   "action"
  ]
 },
 {
  "op": "createIndex",
  "table": "audit_logs",
  "name": "IDX_audit_created_module",
  "unique": false,
  "columns": [
   "createdAt",
   "module"
  ]
 },
 {
  "op": "createIndex",
  "table": "popup",
  "name": "IDX_popup_schedule",
  "unique": false,
  "columns": [
   "isDeleted",
   "isActive",
   "priority",
   "startDate",
   "endDate"
  ]
 },
 {
  "op": "createIndex",
  "table": "conversations",
  "name": "IDX_99cae49af599a01a16b4fd6d6a",
  "unique": false,
  "columns": [
   "lastMessageAt",
   "customerId"
  ]
 },
 {
  "op": "createIndex",
  "table": "messages",
  "name": "IDX_859d7b880b7ea0d5e33e15d2d0",
  "unique": false,
  "columns": [
   "conversationId",
   "createdAt",
   "id"
  ]
 },
 {
  "op": "addForeignKey",
  "table": "product-seo",
  "name": "FK_77936d7d083c62031709394a3e0",
  "columns": [
   "productId"
  ],
  "refTable": "product",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "product_comments",
  "name": "FK_d006299400ef25c37fb0cc6c260",
  "columns": [
   "productId"
  ],
  "refTable": "product",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "product_comments",
  "name": "FK_19dbc08c86e763f9e5615087e90",
  "columns": [
   "userId"
  ],
  "refTable": "user",
  "refColumns": [
   "id"
  ],
  "onDelete": "SET NULL",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "product_comments",
  "name": "FK_0da21099dd984245a245092699d",
  "columns": [
   "parentId"
  ],
  "refTable": "product_comments",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "order-summary",
  "name": "FK_949969bd95e465fd7d9f4e68839",
  "columns": [
   "orderId"
  ],
  "refTable": "orders",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "payment_events",
  "name": "FK_c0f8796eab0370f6dc1d8d10db2",
  "columns": [
   "paymentId"
  ],
  "refTable": "payments",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "payment_refunds",
  "name": "FK_f201eeb6b580759255174f62162",
  "columns": [
   "paymentId"
  ],
  "refTable": "payments",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "payments",
  "name": "FK_af929a5f2a400fdb6913b4967e1",
  "columns": [
   "orderId"
  ],
  "refTable": "orders",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "orders",
  "name": "FK_151b79a83ba240b0cb31b2302d1",
  "columns": [
   "userId"
  ],
  "refTable": "user",
  "refColumns": [
   "id"
  ],
  "onDelete": "NO ACTION",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "user-profile",
  "name": "FK_ddf94d1e8799f9b1a3434963021",
  "columns": [
   "userId"
  ],
  "refTable": "user",
  "refColumns": [
   "id"
  ],
  "onDelete": "NO ACTION",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "customer_risk_phone_hashes",
  "name": "FK_96cf698867aa076c51a41d6c60a",
  "columns": [
   "subject_id"
  ],
  "refTable": "customer_risk_subjects",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "stock_adjustment_items",
  "name": "FK_9b22d8921e8de493d321da03449",
  "columns": [
   "adjustmentId"
  ],
  "refTable": "stock_adjustments",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "coupon_usage",
  "name": "FK_18b10b5df91ce11abe764e6edda",
  "columns": [
   "couponId"
  ],
  "refTable": "coupon",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 },
 {
  "op": "addForeignKey",
  "table": "coupon_usage",
  "name": "FK_302670923e49b67d7f4e9772f64",
  "columns": [
   "userId"
  ],
  "refTable": "user",
  "refColumns": [
   "id"
  ],
  "onDelete": "CASCADE",
  "onUpdate": "NO ACTION"
 }
];
