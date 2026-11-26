/** Vendor payment constants: money paid to a supplier and applied to posted vendor bills. */
import { ACCOUNTING_PAYMENT_METHODS } from "../accounting/schemas.js"

export const VENDOR_PAYMENT_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type VendorPaymentStatus = (typeof VENDOR_PAYMENT_STATUSES)[number]

/** Cash or bank: the accounting event picks the ledger account from the method (SPEC deviation D3). */
export const VENDOR_PAYMENT_METHODS = ACCOUNTING_PAYMENT_METHODS
export type VendorPaymentMethod = (typeof VENDOR_PAYMENT_METHODS)[number]

export const VENDOR_PAYMENT_NUMBER_PREFIX = "VP-"
export const VENDOR_PAYMENT_NUMBER_PAD = 6
export const VENDOR_PAYMENT_NUMBER_REGEX = /^VP-[0-9]{6,}$/ // ck_vendor_payment_number_fmt

export const VENDOR_PAYMENT_REFERENCE_MAX_LENGTH = 100 // ck_vendor_payment_text_len
export const VENDOR_PAYMENT_NOTES_MAX_LENGTH = 1000 // ck_vendor_payment_text_len
export const VENDOR_PAYMENT_REASON_MAX_LENGTH = 500
export const VENDOR_PAYMENT_MAX_ALLOCATIONS = 200
export const VENDOR_PAYMENT_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_vendor_payment_amount_max

/** Payment state of a posted bill. Derived from posted payment allocations, never stored. */
export const BILL_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const
export type BillPaymentStatus = (typeof BILL_PAYMENT_STATUSES)[number]

export const VENDOR_PAYMENT_AUDIT_EVENTS = {
  CREATED: "vendor_payment.created",
  UPDATED: "vendor_payment.updated",
  DELETED: "vendor_payment.deleted",
  POSTED: "vendor_payment.posted",
  REVERSED: "vendor_payment.reversed",
} as const
