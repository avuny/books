/**
 * Purchase order module constants.
 * Limits that back a database check carry the constraint name.
 */

/**
 * Header status. DRAFT, CONFIRMED, CLOSED and CANCELLED are explicit lifecycle states set by
 * the purchase order service; the shipping/receiving states in between are derived from the line
 * counters by `derivePurchaseOrderStatus` and written by the posting services. Clients never
 * patch a status.
 */
export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_SHIPPED",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

/** Statuses in which the order is confirmed and still open for fulfillment. */
export const PURCHASE_ORDER_OPEN_STATUSES = [
  "CONFIRMED",
  "PARTIALLY_SHIPPED",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
] as const satisfies readonly PurchaseOrderStatus[]

export const PURCHASE_ORDER_NUMBER_PREFIX = "PO-"
export const PURCHASE_ORDER_NUMBER_PAD = 6
export const PURCHASE_ORDER_NUMBER_REGEX = /^PO-[0-9]{6,}$/ // ck_purchase_order_number_fmt

export const PURCHASE_ORDER_SUPPLIER_REFERENCE_MAX_LENGTH = 64 // ck_purchase_order_text_len
export const PURCHASE_ORDER_NOTES_MAX_LENGTH = 1000 // ck_purchase_order_text_len
export const PURCHASE_ORDER_LINE_NOTES_MAX_LENGTH = 500 // ck_purchase_order_line_text_len
export const PURCHASE_ORDER_LINE_DESCRIPTION_MAX_LENGTH = 500 // ck_purchase_order_line_text_len
export const PURCHASE_ORDER_REASON_MAX_LENGTH = 500

export const PURCHASE_ORDER_MAX_LINES = 500
/** 15 digits keeps every stored amount below 2^53 (money() is a bigint in number mode). */
export const PURCHASE_ORDER_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_purchase_order_*_amount_max

export const PURCHASE_ORDER_LIST_DEFAULT_PAGE_SIZE = 20
export const PURCHASE_ORDER_LIST_MAX_PAGE_SIZE = 100

export const PURCHASE_ORDER_AUDIT_EVENTS = {
  CREATED: "purchase_order.created",
  UPDATED: "purchase_order.updated",
  DELETED: "purchase_order.deleted",
  CONFIRMED: "purchase_order.confirmed",
  CLOSED: "purchase_order.closed",
  CANCELLED: "purchase_order.cancelled",
} as const
