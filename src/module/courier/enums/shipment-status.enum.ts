/**
 * Internal shipment lifecycle. Deliberately separate from OrderStatus:
 * only a few milestones (dispatched, delivered, returned) move the order.
 * Stored as varchar so adding a state never needs an enum migration.
 */
export enum ShipmentStatus {
    // Not yet accepted by the courier
    PENDING_DISPATCH = 'PENDING_DISPATCH',
    DISPATCH_FAILED = 'DISPATCH_FAILED',
    CANCELLED = 'CANCELLED', // cancelled before it ever reached the courier

    // Accepted by the courier
    IN_REVIEW = 'IN_REVIEW',
    IN_TRANSIT = 'IN_TRANSIT',
    ON_HOLD = 'ON_HOLD',
    APPROVAL_PENDING = 'APPROVAL_PENDING',
    DELIVERED = 'DELIVERED',
    PARTIAL_DELIVERED = 'PARTIAL_DELIVERED',
    // Customer refused / courier cancelled: the parcel is on its way back, NOT in the warehouse yet.
    // Stock is restored only through the RMA inspection flow.
    RETURN_IN_TRANSIT = 'RETURN_IN_TRANSIT',
    UNKNOWN = 'UNKNOWN'
}

export enum CourierProvider {
    STEADFAST = 'STEADFAST'
}

export enum ShipmentEventSource {
    DISPATCH = 'DISPATCH',
    WEBHOOK = 'WEBHOOK',
    POLL = 'POLL',
    ADMIN = 'ADMIN'
}

/** States the courier still owns; these are polled for updates. */
export const ACTIVE_COURIER_STATUSES: ShipmentStatus[] = [
    ShipmentStatus.IN_REVIEW,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.ON_HOLD,
    ShipmentStatus.APPROVAL_PENDING,
    ShipmentStatus.UNKNOWN
];

/** States after which the shipment no longer blocks a new dispatch for the order. */
export const RELEASED_STATUSES: ShipmentStatus[] = [ShipmentStatus.CANCELLED];

/** Customer-safe labels for the storefront. */
export const CUSTOMER_SHIPMENT_LABELS: Record<ShipmentStatus, string> = {
    [ShipmentStatus.PENDING_DISPATCH]: 'Preparing for courier',
    [ShipmentStatus.DISPATCH_FAILED]: 'Preparing for courier',
    [ShipmentStatus.CANCELLED]: 'Courier booking cancelled',
    [ShipmentStatus.IN_REVIEW]: 'Booked with courier',
    [ShipmentStatus.IN_TRANSIT]: 'In transit',
    [ShipmentStatus.ON_HOLD]: 'On hold at courier',
    [ShipmentStatus.APPROVAL_PENDING]: 'Delivery being confirmed',
    [ShipmentStatus.DELIVERED]: 'Delivered',
    [ShipmentStatus.PARTIAL_DELIVERED]: 'Partially delivered',
    [ShipmentStatus.RETURN_IN_TRANSIT]: 'Returning to seller',
    [ShipmentStatus.UNKNOWN]: 'In transit'
};
