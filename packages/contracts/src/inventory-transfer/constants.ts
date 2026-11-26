/**
 * Inventory transfer module constants.
 * Limits that back a database check carry the constraint name.
 */

export const INVENTORY_TRANSFER_STATUSES = [
  "DRAFT",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
] as const
export type InventoryTransferStatus = (typeof INVENTORY_TRANSFER_STATUSES)[number]

/** One row per stock-moving event after dispatch: goods arrive, go back to the source, or are written off. */
export const INVENTORY_TRANSFER_EVENT_KINDS = ["RECEIPT", "RETURN", "LOSS"] as const
export type InventoryTransferEventKind = (typeof INVENTORY_TRANSFER_EVENT_KINDS)[number]

export const INVENTORY_TRANSFER_EVENT_STATUSES = ["POSTED", "REVERSED"] as const
export type InventoryTransferEventStatus = (typeof INVENTORY_TRANSFER_EVENT_STATUSES)[number]

/** Stock movement source types (movement source index is unique per source type and id). */
export const INVENTORY_TRANSFER_SOURCE_TYPES = {
  DISPATCH: "inventory_transfer_dispatch",
  RECEIPT: "inventory_transfer_receipt",
  RETURN: "inventory_transfer_return",
  LOSS: "inventory_transfer_loss",
} as const

export const INVENTORY_TRANSFER_NUMBER_PREFIX = "TRF-"
export const INVENTORY_TRANSFER_NUMBER_PAD = 6
export const INVENTORY_TRANSFER_NUMBER_REGEX = /^TRF-[0-9]{6,}$/ // ck_inventory_transfer_number_fmt
export const INVENTORY_TRANSFER_NUMBER_MAX_LENGTH = 32

export const INVENTORY_TRANSFER_REFERENCE_MAX_LENGTH = 64 // ck_inventory_transfer_text_len
export const INVENTORY_TRANSFER_DESCRIPTION_MAX_LENGTH = 500 // ck_inventory_transfer_text_len
export const INVENTORY_TRANSFER_NOTES_MAX_LENGTH = 500 // ck_inventory_transfer_line_text_len, ck_inventory_transfer_event_text_len

export const INVENTORY_TRANSFER_MAX_LINES = 500

export const INVENTORY_TRANSFER_LIST_DEFAULT_PAGE_SIZE = 20
export const INVENTORY_TRANSFER_LIST_MAX_PAGE_SIZE = 100

/** Statuses in which goods are still in the IN-TRANSIT location. */
export const INVENTORY_TRANSFER_OPEN_STATUSES = ["IN_TRANSIT", "PARTIALLY_RECEIVED"] as const

/** Must match the events declared for the `inventory_transfer` module in the MODULES registry. */
export const INVENTORY_TRANSFER_AUDIT_EVENTS = {
  CREATED: "inventory_transfer.created",
  UPDATED: "inventory_transfer.updated",
  DELETED: "inventory_transfer.deleted",
  DISPATCHED: "inventory_transfer.dispatched",
  RECEIVED: "inventory_transfer.received",
  RETURNED: "inventory_transfer.returned",
  CLOSED_SHORT: "inventory_transfer.closed_short",
  CANCELLED: "inventory_transfer.cancelled",
  REVERSED: "inventory_transfer.reversed",
} as const
export type InventoryTransferAuditEvent =
  (typeof INVENTORY_TRANSFER_AUDIT_EVENTS)[keyof typeof INVENTORY_TRANSFER_AUDIT_EVENTS]
