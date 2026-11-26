/** Vendor bill (supplier invoice) constants: the accounts payable document that matches goods already received. */

export const VENDOR_BILL_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type VendorBillStatus = (typeof VENDOR_BILL_STATUSES)[number]

export const VENDOR_BILL_NUMBER_PREFIX = "BILL-"
export const VENDOR_BILL_NUMBER_PAD = 6
export const VENDOR_BILL_NUMBER_REGEX = /^BILL-[0-9]{6,}$/ // ck_vendor_bill_number_fmt

export const VENDOR_BILL_SUPPLIER_INVOICE_MAX_LENGTH = 100 // ck_vendor_bill_text_len
export const VENDOR_BILL_NOTES_MAX_LENGTH = 1000 // ck_vendor_bill_text_len
export const VENDOR_BILL_REASON_MAX_LENGTH = 500
export const VENDOR_BILL_LINE_DESCRIPTION_MAX_LENGTH = 500 // ck_vendor_bill_line_text_len
export const VENDOR_BILL_MAX_LINES = 500
export const VENDOR_BILL_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_vendor_bill_*_amount_max
export const VENDOR_BILL_MAX_RATE_BPS = 10_000

/** Source type written on the journal entry of a posted bill. */
export const VENDOR_BILL_SOURCE_TYPE = "vendor_bill"

/** How much of a posted receipt has been billed. Derived from posted bill lines, never stored. */
export const RECEIPT_BILL_STATUSES = ["NOT_APPLICABLE", "AWAITING_BILL", "PARTIALLY_BILLED", "BILLED"] as const
export type ReceiptBillStatus = (typeof RECEIPT_BILL_STATUSES)[number]

export const VENDOR_BILL_AUDIT_EVENTS = {
  CREATED: "vendor_bill.created",
  UPDATED: "vendor_bill.updated",
  DELETED: "vendor_bill.deleted",
  POSTED: "vendor_bill.posted",
  REVERSED: "vendor_bill.reversed",
} as const
