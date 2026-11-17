/**
 * Inventory reservation status values.
 * Keep values append-only because these values are persisted by PostgreSQL enums.
 */
export const INVENTORY_RESERVATION_STATUSES = ["ACTIVE", "CLOSED"] as const
export type InventoryReservationStatus = (typeof INVENTORY_RESERVATION_STATUSES)[number]

/** Minimum/maximum source type length (ck_inventory_reservation_source_type_len). */
export const INVENTORY_RESERVATION_SOURCE_TYPE_MIN_LENGTH = 1
export const INVENTORY_RESERVATION_SOURCE_TYPE_MAX_LENGTH = 64

/** Maximum human-readable source reference length (ck_inventory_reservation_source_ref_len). */
export const INVENTORY_RESERVATION_SOURCE_REF_MAX_LENGTH = 100

/** Maximum reservation note length (ck_inventory_reservation_note_len). */
export const INVENTORY_RESERVATION_NOTE_MAX_LENGTH = 1000
