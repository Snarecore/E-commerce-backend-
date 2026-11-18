import { ShipmentStatus } from '../../enums/shipment-status.enum';

/**
 * Steadfast delivery_status -> internal ShipmentStatus.
 * Source: community package docs (not an official contract). Unknown values map to UNKNOWN
 * and flag the shipment for a human instead of guessing.
 */
const STEADFAST_STATUS_MAP: Record<string, ShipmentStatus> = {
    in_review: ShipmentStatus.IN_REVIEW,
    pending: ShipmentStatus.IN_TRANSIT,
    hold: ShipmentStatus.ON_HOLD,
    delivered_approval_pending: ShipmentStatus.APPROVAL_PENDING,
    partial_delivered_approval_pending: ShipmentStatus.APPROVAL_PENDING,
    cancelled_approval_pending: ShipmentStatus.APPROVAL_PENDING,
    unknown_approval_pending: ShipmentStatus.APPROVAL_PENDING,
    delivered: ShipmentStatus.DELIVERED,
    partial_delivered: ShipmentStatus.PARTIAL_DELIVERED,
    // Steadfast "cancelled" = customer refused / not deliverable; parcel is coming back.
    cancelled: ShipmentStatus.RETURN_IN_TRANSIT,
    unknown: ShipmentStatus.UNKNOWN
};

export function mapSteadfastStatus(raw: string | null | undefined): ShipmentStatus {
    const key = String(raw || '').trim().toLowerCase();
    return STEADFAST_STATUS_MAP[key] ?? ShipmentStatus.UNKNOWN;
}

export function isKnownSteadfastStatus(raw: string | null | undefined): boolean {
    return String(raw || '').trim().toLowerCase() in STEADFAST_STATUS_MAP;
}
