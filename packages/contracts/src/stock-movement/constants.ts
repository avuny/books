/** Stock movement module constants. Limits that back a database check carry the constraint name. */

/**
 * Why stock moved. Append only: it backs the stock_movement_type enum.
 * Each type fixes which side is a system counterparty location (see rules.ts).
 */
export const STOCK_MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "purchase_return",
  "sale",
  "sale_return",
  "transfer",
  "adjustment",
  "assembly_consume",
  "assembly_produce",
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

/** The document that caused the movement, named by the module that posts it (e.g. "sales_delivery"). */
export const STOCK_MOVEMENT_SOURCE_TYPE_MAX_LENGTH = 40 // ck_stock_movement_text_len
export const STOCK_MOVEMENT_SOURCE_TYPE_REGEX = /^[a-z][a-z0-9_]*$/
export const STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH = 64 // ck_stock_movement_text_len
export const STOCK_MOVEMENT_NOTE_MAX_LENGTH = 500 // ck_stock_movement_text_len

export const STOCK_MOVEMENT_MAX_LINES = 1000

/**
 * Positive decimal string in the item's base unit. Never convert to number.
 * Digits must fit the quantity() column of @avuny/db (12 integer + 4 decimal digits here).
 */
export const STOCK_MOVEMENT_QUANTITY_REGEX = /^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,4})?$/

export const STOCK_MOVEMENT_LIST_DEFAULT_PAGE_SIZE = 20
export const STOCK_MOVEMENT_LIST_MAX_PAGE_SIZE = 100
export const STOCK_MOVEMENT_ON_HAND_MAX_ITEMS = 200
