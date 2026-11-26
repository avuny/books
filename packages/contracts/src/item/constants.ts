/**
 * How the cost of stock leaving the warehouse is calculated.
 * Postgres cannot drop enum values, so only ever append here.
 * LIFO is deliberately absent (not allowed under IFRS).
 */
export const INVENTORY_VALUATION_METHODS = ["fifo", "weighted_average"] as const
export type InventoryValuationMethod = (typeof INVENTORY_VALUATION_METHODS)[number]
export const DEFAULT_INVENTORY_VALUATION_METHOD: InventoryValuationMethod = "fifo"

export const ITEM_NAME_MIN_LENGTH = 1
export const ITEM_NAME_MAX_LENGTH = 200 // ck_item_name_len
export const ITEM_DESCRIPTION_MAX_LENGTH = 2000

/* ---------- API-level constants (no database check behind them) ---------- */

export const ITEM_OPENING_STOCK_SOURCE_TYPE = "item_opening" as const

export const ITEM_SEARCH_MAX_LENGTH = 100
export const ITEM_LIST_DEFAULT_PAGE_SIZE = 20
export const ITEM_LIST_MAX_PAGE_SIZE = 100

export const ITEM_AUDIT_EVENTS = {
  CREATED: "item.created",
  UPDATED: "item.updated",
  DELETED: "item.deleted",
} as const

export type ItemAuditEvent =
  (typeof ITEM_AUDIT_EVENTS)[keyof typeof ITEM_AUDIT_EVENTS]