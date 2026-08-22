-- SQL Migration Script to update 'orders' table for COD and extended order fields

ALTER TABLE `orders`
  MODIFY COLUMN `paymentIntentId` varchar(255) NULL,
  MODIFY COLUMN `status` enum('Order Placed','Preparing Order','Loaded for Delivery','Handed Over to Courier','Out for Delivery','Delivered','Cancelled','Returned','Pending','Completed','Failed') NOT NULL DEFAULT 'Order Placed',
  MODIFY COLUMN `paymentStatus` enum('Pending','Paid','Unpaid','Failed') NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS `paymentMethod` varchar(255) NULL DEFAULT 'COD',
  ADD COLUMN IF NOT EXISTS `shippingAddress` json NULL,
  ADD COLUMN IF NOT EXISTS `specialNote` text NULL,
  ADD COLUMN IF NOT EXISTS `subtotal` decimal(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `deliveryCharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `courierName` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `trackingId` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `courierTrackingLink` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `idempotencyKey` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `statusHistory` json NULL;
