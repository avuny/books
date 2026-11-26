/** Supplier shipment constants (dispatch event that moves quantity from On Order to In Transit). */

export const PURCHASE_SHIPMENT_STATUSES = ["DRAFT", "POSTED", "VOIDED"] as const
export type PurchaseShipmentStatus = (typeof PURCHASE_SHIPMENT_STATUSES)[number]

export const PURCHASE_SHIPMENT_NUMBER_PREFIX = "PS-"
export const PURCHASE_SHIPMENT_NUMBER_PAD = 6
export const PURCHASE_SHIPMENT_NUMBER_REGEX = /^PS-[0-9]{6,}$/ // ck_purchase_shipment_number_fmt

export const PURCHASE_SHIPMENT_CARRIER_MAX_LENGTH = 100 // ck_purchase_shipment_text_len
export const PURCHASE_SHIPMENT_TRACKING_MAX_LENGTH = 100 // ck_purchase_shipment_text_len
export const PURCHASE_SHIPMENT_REFERENCE_MAX_LENGTH = 100 // ck_purchase_shipment_text_len
export const PURCHASE_SHIPMENT_LINE_NOTES_MAX_LENGTH = 500 // ck_purchase_shipment_line_text_len
export const PURCHASE_SHIPMENT_BATCH_REF_MAX_LENGTH = 100 // ck_purchase_shipment_line_text_len
export const PURCHASE_SHIPMENT_REASON_MAX_LENGTH = 500
export const PURCHASE_SHIPMENT_MAX_LINES = 500

export const PURCHASE_SHIPMENT_AUDIT_EVENTS = {
  CREATED: "purchase_shipment.created",
  UPDATED: "purchase_shipment.updated",
  DELETED: "purchase_shipment.deleted",
  POSTED: "purchase_shipment.posted",
  REVERSED: "purchase_shipment.reversed",
} as const
