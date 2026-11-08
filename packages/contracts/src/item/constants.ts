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
