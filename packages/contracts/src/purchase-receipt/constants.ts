/** Purchase receipt (GRN) constants: the physical receiving event that puts accepted stock on hand. */

export const PURCHASE_RECEIPT_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type PurchaseReceiptStatus = (typeof PURCHASE_RECEIPT_STATUSES)[number]

export const PURCHASE_RECEIPT_NUMBER_PREFIX = "PR-"
export const PURCHASE_RECEIPT_NUMBER_PAD = 6
export const PURCHASE_RECEIPT_NUMBER_REGEX = /^PR-[0-9]{6,}$/ // ck_purchase_receipt_number_fmt

export const PURCHASE_RECEIPT_REFERENCE_MAX_LENGTH = 100 // ck_purchase_receipt_text_len
export const PURCHASE_RECEIPT_NOTES_MAX_LENGTH = 1000 // ck_purchase_receipt_text_len
export const PURCHASE_RECEIPT_LINE_NOTES_MAX_LENGTH = 500 // ck_purchase_receipt_line_text_len
export const PURCHASE_RECEIPT_REJECTION_REASON_MAX_LENGTH = 500 // ck_purchase_receipt_line_text_len
export const PURCHASE_RECEIPT_REASON_MAX_LENGTH = 500
export const PURCHASE_RECEIPT_MAX_LINES = 500

/** Source type written on the stock movement and the journal entry of a posted receipt. */
export const PURCHASE_RECEIPT_SOURCE_TYPE = "purchase_receipt"

export const PURCHASE_RECEIPT_AUDIT_EVENTS = {
  CREATED: "purchase_receipt.created",
  UPDATED: "purchase_receipt.updated",
  DELETED: "purchase_receipt.deleted",
  POSTED: "purchase_receipt.posted",
  REVERSED: "purchase_receipt.reversed",
} as const
