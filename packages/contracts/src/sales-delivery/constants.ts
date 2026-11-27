/** Sales delivery (delivery note) constants: the outbound stock event against a confirmed sales order. */

export const SALES_DELIVERY_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type SalesDeliveryStatus = (typeof SALES_DELIVERY_STATUSES)[number]

export const SALES_DELIVERY_NUMBER_PREFIX = "DN-"
export const SALES_DELIVERY_NUMBER_PAD = 6
export const SALES_DELIVERY_NUMBER_REGEX = /^DN-[0-9]{6,}$/ // ck_sales_delivery_number_fmt

export const SALES_DELIVERY_CARRIER_MAX_LENGTH = 100 // ck_sales_delivery_text_len
export const SALES_DELIVERY_TRACKING_MAX_LENGTH = 100 // ck_sales_delivery_text_len
export const SALES_DELIVERY_NOTES_MAX_LENGTH = 1000 // ck_sales_delivery_text_len
export const SALES_DELIVERY_LINE_NOTES_MAX_LENGTH = 500 // ck_sales_delivery_line_text_len
export const SALES_DELIVERY_REASON_MAX_LENGTH = 500
export const SALES_DELIVERY_MAX_LINES = 500

/** Source type written on the stock movement and the cost journal entry of a posted delivery. */
export const SALES_DELIVERY_SOURCE_TYPE = "sales_delivery"

export const SALES_DELIVERY_AUDIT_EVENTS = {
  CREATED: "sales_delivery.created",
  UPDATED: "sales_delivery.updated",
  DELETED: "sales_delivery.deleted",
  POSTED: "sales_delivery.posted",
  REVERSED: "sales_delivery.reversed",
} as const
