/**
 * Sales order module constants.
 * Limits that back a database check carry the constraint name.
 */

/**
 * Header status (SPEC 3.1). Only the commercial lifecycle is stored. Reservation, fulfillment,
 * billing and payment summaries are derived from line counters and child documents.
 * Clients never patch a status.
 */
export const SALES_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "CLOSED", "CANCELLED"] as const
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number]

/** Statuses in which the order is confirmed and still open for fulfillment. */
export const SALES_ORDER_OPEN_STATUSES = ["CONFIRMED"] as const satisfies readonly SalesOrderStatus[]

export const SALES_ORDER_NUMBER_PREFIX = "SO-"
export const SALES_ORDER_NUMBER_PAD = 6
export const SALES_ORDER_NUMBER_REGEX = /^SO-[0-9]{6,}$/ // ck_sales_order_number_fmt

export const SALES_ORDER_CUSTOMER_REFERENCE_MAX_LENGTH = 64 // ck_sales_order_text_len
export const SALES_ORDER_NOTES_MAX_LENGTH = 1000 // ck_sales_order_text_len
export const SALES_ORDER_LINE_NOTES_MAX_LENGTH = 500 // ck_sales_order_line_text_len
export const SALES_ORDER_LINE_DESCRIPTION_MAX_LENGTH = 500 // ck_sales_order_line_text_len
export const SALES_ORDER_REASON_MAX_LENGTH = 500

/** Reservation policy applied on confirm (SPEC 7.3). The default is REQUIRE_FULL_RESERVATION. */
export const SALES_ORDER_RESERVATION_POLICIES = [
  "REQUIRE_FULL_RESERVATION",
  "ALLOW_PARTIAL_RESERVATION",
  "ALLOW_BACKORDER_WITHOUT_RESERVATION",
] as const
export type SalesOrderReservationPolicy = (typeof SALES_ORDER_RESERVATION_POLICIES)[number]
export const SALES_ORDER_DEFAULT_RESERVATION_POLICY: SalesOrderReservationPolicy = "REQUIRE_FULL_RESERVATION"

/** inventory_reservations.source_type for sales orders. */
export const SALES_ORDER_RESERVATION_SOURCE_TYPE = "SALES_ORDER"

export const SALES_ORDER_MAX_LINES = 500
/** 15 digits keeps every stored amount below 2^53 (money() is a bigint in number mode). */
export const SALES_ORDER_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_sales_order_*_amount_max

/** Discount and tax rates are integer basis points (1 bp = 0.01%); 10000 = 100%. ck_sales_order_line_rate_bps */
export const SALES_ORDER_MAX_RATE_BPS = 10_000

export const SALES_ORDER_LIST_DEFAULT_PAGE_SIZE = 20
export const SALES_ORDER_LIST_MAX_PAGE_SIZE = 100

export const SALES_ORDER_AUDIT_EVENTS = {
  CREATED: "sales_order.created",
  UPDATED: "sales_order.updated",
  DELETED: "sales_order.deleted",
  CONFIRMED: "sales_order.confirmed",
  CLOSED: "sales_order.closed",
  CANCELLED: "sales_order.cancelled",
} as const
